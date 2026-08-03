/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { hash } from '../../../base/common/hash.js';
import { URI } from '../../../base/common/uri.js';
import { ISingleFolderWorkspaceIdentifier, IWorkspaceIdentifier } from '../../workspace/common/workspace.js';
import { getDevWorkspaceId } from './che/devWorkspaceId.js';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// NOTE: DO NOT CHANGE. IDENTIFIERS HAVE TO REMAIN STABLE
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

export function getWorkspaceIdentifier(workspaceUri: URI): IWorkspaceIdentifier {
	return {
		id: getWorkspaceId(workspaceUri),
		configPath: workspaceUri
	};
}

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// NOTE: DO NOT CHANGE. IDENTIFIERS HAVE TO REMAIN STABLE
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

export function getSingleFolderWorkspaceIdentifier(folderUri: URI): ISingleFolderWorkspaceIdentifier {
	return {
		id: getWorkspaceId(folderUri),
		uri: folderUri
	};
}

function getWorkspaceId(uri: URI): string {
	const devWorkspaceId = getDevWorkspaceId();
	console.log('[CHE] getWorkspaceId called, devWorkspaceId:', devWorkspaceId, 'uri:', uri.toString());
	if (devWorkspaceId) {
		const id = hash(devWorkspaceId + uri.toString()).toString(16);
		console.log('[CHE] workspace ID (with devWorkspaceId):', id);
		return id;
	}
	const id = hash(uri.toString()).toString(16);
	console.log('[CHE] workspace ID (WITHOUT devWorkspaceId):', id);
	return id;
}
