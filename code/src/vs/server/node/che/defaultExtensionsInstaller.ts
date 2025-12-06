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

import * as path from '../../../base/common/path.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { IFileService } from '../../../platform/files/common/files.js';
import { INativeServerExtensionManagementService } from '../../../platform/extensionManagement/node/extensionManagementService.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { IUserDataProfilesService } from '../../../platform/userDataProfile/common/userDataProfile.js';

export class DefaultExtensionsInstaller extends Disposable {

	constructor(
		private readonly extensionManagementService: INativeServerExtensionManagementService,
		private readonly logService: ILogService,
		private readonly fileService: IFileService,
		private readonly userDataProfilesService: IUserDataProfilesService,
	) {
		super();
		this.initialize().catch(error => {
			this.logService.error('Failed to initialize default extensions installer', error);
		});
	}

	private async initialize(): Promise<void> {
		const defaultExtensionsEnv = typeof process !== 'undefined' && process.env ? process.env['DEFAULT_EXTENSIONS'] : undefined;
		if (!defaultExtensionsEnv) {
			this.logService.info('DefaultExtensionsInstaller: DEFAULT_EXTENSIONS not set, skipping installation');
			return;
		}

		const extensionPaths = defaultExtensionsEnv.split(';').filter(p => p.trim());
		if (extensionPaths.length === 0) {
			this.logService.info('DefaultExtensionsInstaller: No extensions to install');
			return;
		}

		this.logService.info(`!!!!!!!! DefaultExtensionsInstaller: Found ${extensionPaths.length} default extension(s) in DEFAULT_EXTENSIONS`);

		// Track installed extensions in a file to avoid reinstalling
		const storageFile = this.getStorageFile();
		this.logService.info(`!!!!!!!! DefaultExtensionsInstaller: storageFile ${storageFile}`);
		let installedPaths: string[] = [];
		try {
			const content = await this.fileService.readFile(storageFile);
			installedPaths = JSON.parse(content.value.toString());
		} catch (e) {
			// File doesn't exist or is invalid, start fresh
			installedPaths = [];
		}

		const pathsToInstall = extensionPaths.filter(p => !installedPaths.includes(p.trim()));
		if (pathsToInstall.length === 0) {
			this.logService.debug('DefaultExtensionsInstaller: All default extensions already installed');
			return;
		}

		this.logService.info(`DefaultExtensionsInstaller: Installing ${pathsToInstall.length} new default extension(s)`);
		await this.installExtensions(pathsToInstall, storageFile, installedPaths);
	}

	private async installExtensions(
		pathsToInstall: string[],
		storageFile: URI,
		installedPaths: string[]
	): Promise<void> {
		const successfullyInstalled: string[] = [];

		for (const extensionPath of pathsToInstall) {
			const trimmedPath = extensionPath.trim();
			if (!trimmedPath) {
				continue;
			}

			try {
				const vsixUri = URI.file(trimmedPath);
				this.logService.info(`DefaultExtensionsInstaller: Installing extension from ${trimmedPath}`);

				await this.extensionManagementService.install(vsixUri, { 
					isDefault: true // Mark as default extension to bypass policy checks
				});
				successfullyInstalled.push(trimmedPath);
				this.logService.info(`DefaultExtensionsInstaller: Successfully installed extension from ${trimmedPath}`);
			} catch (error) {
				this.logService.error(`DefaultExtensionsInstaller: Failed to install extension from ${trimmedPath}`, error);
				// Continue with other extensions even if one fails
			}
		}

		// Update storage with successfully installed extensions
		if (successfullyInstalled.length > 0) {
			const updatedInstalled = [...installedPaths, ...successfullyInstalled];
			await this.fileService.writeFile(storageFile, VSBuffer.fromString(JSON.stringify(updatedInstalled, null, 2)));
			this.logService.info(`DefaultExtensionsInstaller: Updated storage with ${successfullyInstalled.length} successfully installed extension(s)`);
		}
	}

	private getStorageFile(): URI {
		// Store in the same directory as the extensions profile manifest
		return this.userDataProfilesService.defaultProfile.extensionsResource.with({
			path: path.join(path.dirname(this.userDataProfilesService.defaultProfile.extensionsResource.path), '.default-extensions-installed.json')
		});
	}
}

