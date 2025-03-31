/**********************************************************************
 * Copyright (c) 2025 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

/* eslint-disable header/header */

import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import { DefaultExtensions } from './default-extensions';
import { InstallFromVSIX } from './install-from-vsix';

const CONFIGS_PATH = '/checode-config/configurations.json';
export interface EditorConfigurations {
    [key: string]: any;
}

export class EditorConfigurations {
    constructor(private outputChannel: vscode.OutputChannel) { }

    async initialize(): Promise<void> {
        try {
            const configs = await this.getConfigurations();
            new DefaultExtensions(this.outputChannel, configs).install();

            if (!configs) {
                this.outputChannel.appendLine(`[EditorConfigsHandler] Configurations not found`);
                return;
            }
            await new InstallFromVSIX(this.outputChannel).apply(configs);
        } catch (error) {
            this.outputChannel.appendLine(`[EditorConfigsHandler] Failed to apply editor configurations ${error}`);
        }
    }

    private async getConfigurations(): Promise<EditorConfigurations | undefined> {
        if (!await fs.pathExists(CONFIGS_PATH)) {
            this.outputChannel.appendLine('[EditorConfigsHandler] File with configurations does not exist');
            return;
        }

        try {
            this.outputChannel.appendLine('[EditorConfigsHandler] Reading configurations...');
            const configsFileContent = await fs.readFile(CONFIGS_PATH, 'utf8');
            return JSON.parse(configsFileContent);
        } catch (error) {
            this.outputChannel.appendLine(`[EditorConfigsHandler] Error occurred when read configurations ${error}`);
            return;
        }
    }
}
