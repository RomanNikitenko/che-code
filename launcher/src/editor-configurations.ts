/**********************************************************************
 * Copyright (c) 2024 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

import * as fs from './fs-extra.js';
import { mergeFirstWithSecond, parseJSON } from './json-utils.js';
import { ProductJSON } from './product-json.js';

const CONFIGS_PATH = '/checode-config';
const SETTINGS_PATH = `${CONFIGS_PATH}/settings.json`;
const EXTENSIONS_PATH = `${CONFIGS_PATH}/extensions.json`;
const PRODUCT_PATH = `${CONFIGS_PATH}/product.json`;
const REMOTE_SETTINGS_PATH = '/checode/remote/data/Machine/settings.json';

/**
 * See following documentation for details
 * https://eclipse.dev/che/docs/stable/administration-guide/editor-configurations-for-microsoft-visual-studio-code/
 */

export class EditorConfigurations {
  constructor(private readonly workspaceFilePath?: string) {}

  async configure(): Promise<void> {
    console.log(`# Checking for editor configurations...`);
    if (!(await fs.pathExists(CONFIGS_PATH))) {
      console.log(`  > Configurations are not provided`);
      return;
    }

    try {
      await this.configureSettings();
      await this.configureExtensions();
      await this.configureProductJSON();
    } catch (error) {
      console.log(`  > Failed to apply editor configurations ${error}`);
    }
  }

  private async configureSettings(): Promise<void> {
    if (!(await fs.pathExists(SETTINGS_PATH))) {
      console.log(`  > Settings are not provided`);
      return;
    }
    console.log('  > Configure editor settings...');

    try {
      const settingsFileContent = await fs.readFile(SETTINGS_PATH);
      const settingsFromConfigmap = parseJSON(settingsFileContent, {
        errorMessage: 'Settings content is not valid.',
      });

      let remoteSettingsJson;
      if (await fs.fileExists(REMOTE_SETTINGS_PATH)) {
        console.log(`    > Found setings file: ${REMOTE_SETTINGS_PATH}`);
        const remoteSettingsContent = await fs.readFile(REMOTE_SETTINGS_PATH);
        remoteSettingsJson = parseJSON(remoteSettingsContent, {
          errorMessage: 'Settings.json file is not valid.',
        });
      } else {
        console.log(`    > Creating settings file: ${REMOTE_SETTINGS_PATH}`);
        remoteSettingsJson = {};
      }

      const mergedSettings = { ...remoteSettingsJson, ...settingsFromConfigmap };
      const json = JSON.stringify(mergedSettings, null, '\t');
      await fs.writeFile(REMOTE_SETTINGS_PATH, json);

      console.log('    > Editor settings have been configured.');
    } catch (error) {
      console.log('Failed to configure editor settings.', error);
    }
  }

  private async configureExtensions(): Promise<void> {
    if (!(await fs.pathExists(EXTENSIONS_PATH))) {
      console.log(`  > Extensions are not provided`);
      return;
    }
    console.log('  > Configure workspace extensions...');

    try {
      const extensionsFileContent = await fs.readFile(EXTENSIONS_PATH);
      const extensionsFromConfigmap = parseJSON(extensionsFileContent, {
        errorMessage: 'Extensions content is not valid.',
      });

      if (!this.workspaceFilePath) {
        console.log('    > Missing workspace file. Skip this step.');
        return;
      }

      if (!(await fs.fileExists(this.workspaceFilePath))) {
        console.log(`    > Unable to find workspace file: ${this.workspaceFilePath}. Skip this step.`);
        return;
      }

      console.log(`    > Found workspace file: ${this.workspaceFilePath}`);

      const workspaceFileContent = await fs.readFile(this.workspaceFilePath);
      const workspaceConfigData = parseJSON(workspaceFileContent, {
        errorMessage: 'Workspace file is not valid.',
      });

      workspaceConfigData['extensions'] = {
        ...(workspaceConfigData['extensions'] || {}),
        ...extensionsFromConfigmap,
      };

      const json = JSON.stringify(workspaceConfigData, null, '\t');
      await fs.writeFile(this.workspaceFilePath, json);
      console.log('    > Workspace extensions have been configured.');
    } catch (error) {
      console.log('Failed to configure workspace extensions.', error);
    }
  }

  private async configureProductJSON(): Promise<void> {
    if (!(await fs.pathExists(PRODUCT_PATH))) {
      console.log(`  > product.json content is not provided`);
      return;
    }
    console.log('  > Configure product.json ...');

    try {
      const productFileContent = await fs.readFile(PRODUCT_PATH);
      const productFromConfigmap = parseJSON(productFileContent, {
        errorMessage: 'product.json content is not valid.',
      });

      const product = new ProductJSON();
      await product.load();

      mergeFirstWithSecond(productFromConfigmap, product.get());

      await product.save();

      console.log('    > product.json have been configured.');
    } catch (error) {
      console.log('Failed to configure product.json.', error);
    }
  }
}
