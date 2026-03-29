/**********************************************************************
 * Copyright (c) 2022-2025 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/


/* eslint-disable header/header */

if (Reflect.metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}

import { Container } from 'inversify';
import * as vscode from 'vscode';
import { Api } from './api/api';
import { DevfileService } from './api/devfile-service';
import { K8SService } from './api/k8s-service';
import { WorkspaceService } from './api/workspace-service';
import { GithubService } from './api/github-service';
import { TelemetryService } from './api/telemetry-service';
import { Logger } from './logger';

export async function activate(_extensionContext: vscode.ExtensionContext): Promise<Api> {
    const [
        { K8sDevfileServiceImpl },
        { K8SServiceImpl },
        { K8sDevWorkspaceEnvVariables },
        { K8sWorkspaceServiceImpl },
        { GithubServiceImpl },
        { K8sTelemetryServiceImpl },
    ] = await Promise.all([
        import('./impl/k8s-devfile-service-impl'),
        import('./impl/k8s-service-impl'),
        import('./impl/k8s-devworkspace-env-variables'),
        import('./impl/k8s-workspace-service-impl'),
        import('./impl/github-service-impl'),
        import('./impl/k8s-telemetry-service-impl'),
    ]);

    const container = new Container();
    container.bind(K8sDevfileServiceImpl).toSelf().inSingletonScope();
    container.bind(DevfileService).to(K8sDevfileServiceImpl).inSingletonScope();
    container.bind(WorkspaceService).to(K8sWorkspaceServiceImpl).inSingletonScope();
    container.bind(K8SServiceImpl).toSelf().inSingletonScope();
    container.bind(K8SService).to(K8SServiceImpl).inSingletonScope();
    container.bind(K8sDevWorkspaceEnvVariables).toSelf().inSingletonScope();
    container.bind(GithubServiceImpl).toSelf().inSingletonScope();
    container.bind(GithubService).to(GithubServiceImpl).inSingletonScope();
    container.bind(TelemetryService).to(K8sTelemetryServiceImpl).inSingletonScope();
    container.bind(Logger).toSelf().inSingletonScope();

    const api: Api = {
        getDevfileService(): DevfileService {
            return container.get(DevfileService) as DevfileService;
        },
        getWorkspaceService(): WorkspaceService {
            return container.get(WorkspaceService) as WorkspaceService;
        },
        getGithubService(): GithubService {
            return container.get(GithubService) as GithubService;
        },
        getTelemetryService(): TelemetryService {
            return container.get(TelemetryService) as TelemetryService;
        },
    };

    const k8sDevWorkspaceEnvVariables = container.get(K8sDevWorkspaceEnvVariables);
    const dashboardUrl = k8sDevWorkspaceEnvVariables.getDashboardURL();
    const workspaceNamespace = k8sDevWorkspaceEnvVariables.getWorkspaceNamespace();
    const workspaceName = k8sDevWorkspaceEnvVariables.getWorkspaceName();
    const projectsRoot = k8sDevWorkspaceEnvVariables.getProjectsRoot();

    _extensionContext.environmentVariableCollection.replace('DASHBOARD_URL', dashboardUrl);
    _extensionContext.environmentVariableCollection.replace('WORKSPACE_NAME', workspaceName);
    _extensionContext.environmentVariableCollection.replace('WORKSPACE_NAMESPACE', workspaceNamespace);
    _extensionContext.environmentVariableCollection.replace('PROJECTS_ROOT', projectsRoot);

    return api;
}
