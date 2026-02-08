/**********************************************************************
 * Copyright (c) 2022-2023 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

/* eslint-disable header/header */

import { V1alpha2DevWorkspaceSpecTemplate, V1alpha2DevWorkspaceSpecTemplateCommands, V1alpha2DevWorkspaceSpecTemplateCommandsItemsExecEnv } from '@devfile/api';
import * as vscode from 'vscode';

interface DevfileTaskDefinition extends vscode.TaskDefinition {
	command: string;
	workdir?: string;
	component?: string;
	commandId?: string;
}

export class DevfileTaskProvider implements vscode.TaskProvider {
	private execTaskById = new Map<string, vscode.Task>();
	private compositeConfigById = new Map<string, { name: string; commandIds: string[]; parallel: boolean }>();

	constructor(private channel: vscode.OutputChannel, private cheAPI: any, private terminalExtAPI: any) {
	}

	provideTasks(): vscode.ProviderResult<vscode.Task[]> {
		return this.computeTasks();
	}

	resolveTask(task: vscode.Task): vscode.ProviderResult<vscode.Task> {
		return task;
	}

	private async computeTasks(): Promise<vscode.Task[]> {
		const devfileCommands = await this.fetchDevfileCommands();

		const localCommands = devfileCommands!
			.filter(command => {
				const importedByAttribute = (command.attributes as any)?.['controller.devfile.io/imported-by'];
				return !command.attributes || importedByAttribute === undefined || importedByAttribute === 'parent';
			})
			.filter(command => !/^init-ssh-agent-command-\d+$/.test(command.id));

		this.execTaskById.clear();
		const execTasks: vscode.Task[] = localCommands
			.filter(command => command.exec?.commandLine)
			.map(command => {
				const task = this.createCheTask(
					command.exec?.label || command.id,
					command.exec?.commandLine!,
					command.exec?.workingDir || '${PROJECT_SOURCE}',
					command.exec?.component!,
					command.exec?.env,
					command.id
				);
				this.execTaskById.set(command.id, task);
				return task;
			});

		this.compositeConfigById.clear();
		const compositeTasks: vscode.Task[] = localCommands
			.filter(command => (command as any).composite?.commands?.length)
			.map(command => {
				const composite = (command as any).composite;
				const name = composite?.label || command.id;
				const commandIds = composite?.commands || [];
				const parallel = Boolean(composite?.parallel);
				this.compositeConfigById.set(command.id, { name, commandIds, parallel });
				return this.createCompositeTask(name, commandIds, parallel, command.id);
			});

		return [...execTasks, ...compositeTasks];
	}

	private async fetchDevfileCommands(): Promise<V1alpha2DevWorkspaceSpecTemplateCommands[]> {
		const devfileService = this.cheAPI.getDevfileService();
		const devfile: V1alpha2DevWorkspaceSpecTemplate = await devfileService.get();
		if (devfile.commands && devfile.commands.length) {
			this.channel.appendLine(`Detected ${devfile.commands.length} Command(s) in the flattened Devfile.`);
			return devfile.commands;
		}
		return [];
	}

	private createCheTask(
		name: string,
		command: string,
		workdir: string,
		component: string,
		env?: Array<V1alpha2DevWorkspaceSpecTemplateCommandsItemsExecEnv>,
		commandId?: string
	): vscode.Task {
		function expandEnvVariables(line: string): string {
			const regex = /\${[a-zA-Z_][a-zA-Z0-9_]*}/g;
			const envArray = line.match(regex);
			if (envArray && envArray.length) {
				for (const envName of envArray) {
					const envValue = process.env[envName.slice(2, -1)];
					if (envValue) {
						line = line.replace(envName, envValue);
					}
				}
			}
			return line;
		}

		const kind: DevfileTaskDefinition = {
			type: 'devfile',
			command,
			workdir,
			component,
			commandId
		};

		const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
			let initialVariables = '';
			if (env) {
				for (const e of env) {
					let value = e.value.replaceAll('"', '\\"');
					initialVariables += `export ${e.name}="${value}"; `;
				}
			}

			return this.terminalExtAPI.getMachineExecPTY(component, initialVariables + command, expandEnvVariables(workdir));
		});
		const task = new vscode.Task(kind, vscode.TaskScope.Workspace, name, 'devfile', execution, []);
		return task;
	}

	private createCompositeTask(name: string, _commandIds: string[], _parallel: boolean, commandId: string): vscode.Task {
		const kind: DevfileTaskDefinition = {
			type: 'devfile',
			command: `composite:${commandId}`,
			commandId
		};

		const execution = this.createCompositeExecution(commandId);
		const task = new vscode.Task(kind, vscode.TaskScope.Workspace, name, 'devfile', execution, []);
		task.presentationOptions = {
			reveal: vscode.TaskRevealKind.Never,
			panel: vscode.TaskPanelKind.Shared,
			focus: false,
			echo: false,
			showReuseMessage: false,
			close: true
		};
		return task;
	}

	private createCompositeExecution(commandId: string): vscode.CustomExecution {
		const writeEmitter = new vscode.EventEmitter<string>();
		const closeEmitter = new vscode.EventEmitter<number | void>();
		const activeExecutions: vscode.TaskExecution[] = [];

		return new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
			const pty: vscode.Pseudoterminal = {
				onDidWrite: writeEmitter.event,
				onDidClose: closeEmitter.event,
				open: async () => {
					let exitCode = 0;
					try {
						const result = await this.runCompositeById(commandId, activeExecutions);
						if (result.failed) {
							exitCode = 1;
						}
					} catch (error) {
						exitCode = 1;
						const message = `Composite task failed: ${String(error)}`;
						writeEmitter.fire(`${message}\r\n`);
						this.channel.appendLine(message);
					} finally {
						closeEmitter.fire(exitCode);
					}
				},
				close: () => {
					for (const execution of activeExecutions) {
						execution.terminate();
					}
				}
			};
			return pty;
		});
	}

	private async runCompositeById(commandId: string, activeExecutions: vscode.TaskExecution[]): Promise<{ failed: boolean }> {
		const config = this.compositeConfigById.get(commandId);
		if (!config) {
			this.channel.appendLine(`Composite task not found: ${commandId}`);
			return { failed: true };
		}
		return this.runCompositeCommands(config.commandIds, config.parallel, activeExecutions, []);
	}

	private async runCompositeCommands(
		commandIds: string[],
		parallel: boolean,
		activeExecutions: vscode.TaskExecution[],
		stack: string[]
	): Promise<{ failed: boolean }> {
		if (parallel) {
			const results = await Promise.all(commandIds.map(id => this.runCommandById(id, activeExecutions, stack)));
			return { failed: results.some(result => result.failed) };
		}

		let failed = false;
		for (const id of commandIds) {
			const result = await this.runCommandById(id, activeExecutions, stack);
			if (result.failed) {
				failed = true;
			}
		}
		return { failed };
	}

	private async runCommandById(
		commandId: string,
		activeExecutions: vscode.TaskExecution[],
		stack: string[]
	): Promise<{ failed: boolean }> {
		if (stack.includes(commandId)) {
			this.channel.appendLine(`Composite cycle detected: ${[...stack, commandId].join(' -> ')}`);
			return { failed: true };
		}
		const execTask = this.execTaskById.get(commandId);
		if (execTask) {
			const execution = await vscode.tasks.executeTask(execTask);
			activeExecutions.push(execution);
			const failed = await this.waitForTaskEnd(execution);
			return { failed };
		}

		const compositeConfig = this.compositeConfigById.get(commandId);
		if (compositeConfig) {
			return this.runCompositeCommands(compositeConfig.commandIds, compositeConfig.parallel, activeExecutions, [...stack, commandId]);
		}

		this.channel.appendLine(`Composite dependency not found: ${commandId}`);
		return { failed: true };
	}

	private waitForTaskEnd(execution: vscode.TaskExecution): Promise<boolean> {
		return new Promise(resolve => {
			let exitCode: number | undefined;
			const processDisposable = vscode.tasks.onDidEndTaskProcess(event => {
				if (event.execution === execution) {
					exitCode = event.exitCode;
				}
			});
			const disposable = vscode.tasks.onDidEndTask(event => {
				if (event.execution === execution) {
					processDisposable.dispose();
					disposable.dispose();
					resolve(exitCode !== undefined && exitCode !== 0);
				}
			});
		});
	}
}
