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
	isComposite?: boolean;
}

type DevfileCommandEntry =
	| { kind: 'exec'; task: vscode.Task }
	| { kind: 'composite'; name: string; commandIds: string[]; parallel: boolean };

export class DevfileTaskProvider implements vscode.TaskProvider {
	private commandById = new Map<string, DevfileCommandEntry>();
	private tasksCache: vscode.Task[] | undefined;

	constructor(private channel: vscode.OutputChannel, private cheAPI: any, private terminalExtAPI: any) {
	}

	provideTasks(): vscode.ProviderResult<vscode.Task[]> {
		return this.computeTasks();
	}

	async resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
		this.channel.appendLine('++++++++++ RESOLVE TASK ');
		
		const definition = task.definition as DevfileTaskDefinition;
		if (!definition || definition.type !== 'devfile') {
			return task;
		}

		await this.computeTasks();

		if (definition.isComposite) {
			const commandId = definition.commandId || this.getCompositeIdFromCommand(definition.command);
			if (commandId) {
				return this.createCompositeTask(task.name, commandId);
			}
		} else if (definition.commandId) {
			const entry = this.commandById.get(definition.commandId);
			if (entry?.kind === 'exec') {
				return entry.task;
			}
		}

		const cached = this.tasksCache?.find(candidate => candidate.name === task.name);
		return cached ?? task;
	}

	private async computeTasks(): Promise<vscode.Task[]> {
		if (this.tasksCache) {
			return this.tasksCache;
		}
		const devfileCommands = await this.fetchDevfileCommands();

		const localCommands = devfileCommands!
			.filter(command => {
				const importedByAttribute = (command.attributes as any)?.['controller.devfile.io/imported-by'];
				return !command.attributes || importedByAttribute === undefined || importedByAttribute === 'parent';
			})
			.filter(command => !/^init-ssh-agent-command-\d+$/.test(command.id));

		this.commandById.clear();
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
				this.commandById.set(command.id, { kind: 'exec', task });
				return task;
			});

		const compositeTasks: vscode.Task[] = localCommands
			.filter(command => (command as any).composite?.commands?.length)
			.map(command => {
				const composite = (command as any).composite;
				const name = composite?.label || command.id;
				const commandIds = composite?.commands || [];
				const parallel = Boolean(composite?.parallel);
				this.commandById.set(command.id, { kind: 'composite', name, commandIds, parallel });
				return this.createCompositeTask(name, command.id);
			});

		this.tasksCache = [...execTasks, ...compositeTasks];
		return this.tasksCache;
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

	private createCompositeTask(name: string, commandId: string): vscode.Task {
		const kind: DevfileTaskDefinition = {
			type: 'devfile',
			command: `composite:${commandId}`,
			commandId,
			isComposite: true
		};

		const execution = this.createCompositeExecution(commandId);
		const task = new vscode.Task(kind, vscode.TaskScope.Workspace, name, 'devfile', execution, []);
		task.presentationOptions = {
			reveal: vscode.TaskRevealKind.Silent,
			panel: vscode.TaskPanelKind.Dedicated,
			focus: false,
			echo: false,
			showReuseMessage: false,
			close: false
		};
		return task;
	}

	private createCompositeExecution(commandId: string): vscode.CustomExecution {
		const writeEmitter = new vscode.EventEmitter<string>();
		const closeEmitter = new vscode.EventEmitter<number | void>();
		const activeExecutions: vscode.TaskExecution[] = [];
		const write = (message: string): void => {
			writeEmitter.fire(message.endsWith('\n') ? message : `${message}\r\n`);
		};

		return new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
			const pty: vscode.Pseudoterminal = {
				onDidWrite: writeEmitter.event,
				onDidClose: closeEmitter.event,
				open: async () => {
					let exitCode = 0;
					try {
						write(`Composite task started: ${commandId}`);
						const result = await this.runCompositeById(commandId, activeExecutions, write);
						if (result.failed) {
							exitCode = 1;
						}
					} catch (error) {
						exitCode = 1;
						const message = `Composite task failed: ${String(error)}`;
						write(message);
						this.channel.appendLine(message);
					} finally {
						write(`Composite task finished: ${commandId}`);
						closeEmitter.fire(exitCode);
					}
				},
				close: () => {
					for (const execution of activeExecutions) {
						execution.terminate();
					}
					write('Composite task terminated by user.');
				}
			};
			return pty;
		});
	}

	private async runCompositeById(
		commandId: string,
		activeExecutions: vscode.TaskExecution[],
		write: (message: string) => void
	): Promise<{ failed: boolean }> {
		if (this.commandById.size === 0) {
			await this.computeTasks();
		}
		const entry = this.commandById.get(commandId);
		if (!entry || entry.kind !== 'composite') {
			const message = `Composite task not found: ${commandId}`;
			write(message);
			this.channel.appendLine(message);
			return { failed: true };
		}
		return this.runCompositeCommands(entry.commandIds, entry.parallel, activeExecutions, [], write);
	}

	private async runCompositeCommands(
		commandIds: string[],
		parallel: boolean,
		activeExecutions: vscode.TaskExecution[],
		stack: string[],
		write: (message: string) => void
	): Promise<{ failed: boolean }> {
		if (parallel) {
			const results = await Promise.all(commandIds.map(id => this.runCommandById(id, activeExecutions, stack, write)));
			return { failed: results.some(result => result.failed) };
		}

		let failed = false;
		for (const id of commandIds) {
			const result = await this.runCommandById(id, activeExecutions, stack, write);
			if (result.failed) {
				failed = true;
			}
		}
		return { failed };
	}

	private async runCommandById(
		commandId: string,
		activeExecutions: vscode.TaskExecution[],
		stack: string[],
		write: (message: string) => void
	): Promise<{ failed: boolean }> {
		if (stack.includes(commandId)) {
			const message = `Composite cycle detected: ${[...stack, commandId].join(' -> ')}`;
			write(message);
			this.channel.appendLine(message);
			return { failed: true };
		}
		const entry = this.commandById.get(commandId);
		if (entry?.kind === 'exec') {
			write(`Starting ${entry.task.name}`);
			const execution = await vscode.tasks.executeTask(entry.task);
			activeExecutions.push(execution);
			const result = await this.waitForTaskEnd(execution);
			const status = result.exitCode === undefined ? 'unknown' : result.exitCode;
			write(`Completed ${entry.task.name} (exit code ${status})`);
			return { failed: result.exitCode !== undefined && result.exitCode !== 0 };
		}

		if (entry?.kind === 'composite') {
			return this.runCompositeCommands(entry.commandIds, entry.parallel, activeExecutions, [...stack, commandId], write);
		}

		const message = `Composite dependency not found: ${commandId}`;
		write(message);
		this.channel.appendLine(message);
		return { failed: true };
	}

	private waitForTaskEnd(execution: vscode.TaskExecution): Promise<{ exitCode: number | undefined }> {
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
					resolve({ exitCode });
				}
			});
		});
	}

	private getCompositeIdFromCommand(command?: string): string | undefined {
		if (!command) {
			return undefined;
		}
		return command.startsWith('composite:') ? command.slice('composite:'.length) : undefined;
	}
}
