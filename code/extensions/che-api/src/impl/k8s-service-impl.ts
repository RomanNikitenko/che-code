/**********************************************************************
 * Copyright (c) 2021 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

/* eslint-disable header/header */
import {
  devworkspaceGroup,
  devworkspaceLatestVersion,
  devworkspacePlural,
  V1alpha2DevWorkspace
} from '@devfile/api';
import { CoreV1Api, CustomObjectsApi, KubeConfig } from '@kubernetes/client-node';
import type { ApiConstructor, ApiType, V1Secret } from '@kubernetes/client-node';

import * as vscode from 'vscode';
import { injectable } from 'inversify';
import { K8SRawResponse, K8SService } from '../api/k8s-service';
import { env } from 'process';
import { Agent as HttpsAgent } from 'https';
import fetch, { RequestInit } from 'node-fetch';

@injectable()
export class K8SServiceImpl implements K8SService {
  private coreV1API!: CoreV1Api;
  private customObjectsApi!: CustomObjectsApi;
  private k8sConfig: KubeConfig;
  private devWorkspaceName!: string;
  private devWorkspaceNamespace!: string;

  constructor() {
    this.k8sConfig = new KubeConfig();
  }

  async ensureKubernetesServiceHostWhitelisted(): Promise<void> {
    const proxy = env.HTTPS_PROXY || env.HTTP_PROXY || env.https_proxy || env.http_proxy;
    const noProxy = env.NO_PROXY || env.no_proxy;
    if (proxy && noProxy && env.KUBERNETES_SERVICE_HOST) {

      // take k8s service host
      const k8sHost = env.KUBERNETES_SERVICE_HOST;

      // check whether it is set to no_proxy environment variable
      if (!noProxy.split(',').includes(k8sHost)) {
        const action = await vscode.window.showInformationMessage(
          'The cluster you are using is behind a proxy, but kubernetes service host is not whitelisted in no_proxy environment variable. ' +
          'This may cause the kubernetes service to be unaccessible. ' +
          'Do you want to fix this and add the kubernetes service host to the no_proxy environment variable?', 'Add', 'Cancel');

        if ('Add' === action) {
          if (env.NO_PROXY) {
            env.NO_PROXY += ',' + k8sHost;
            console.log('Kubernetes Service Host has been added to env.NO_PROXY environment variable');
          }
          if (env.no_proxy) {
            env.no_proxy += ',' + k8sHost;
            console.log('Kubernetes Service Host has been added to env.no_proxy environment variable');
          }
        }
      }

    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendRawQuery(requestURL: string, opts: any): Promise<K8SRawResponse> {
    this.k8sConfig.applyToHTTPSOptions(opts);
    const cluster = this.k8sConfig.getCurrentCluster();
    if (!cluster) {
      throw new Error('K8S cluster is not defined');
    }
    const URL = `${cluster.server}${requestURL}`;

    return this.makeRequest(URL, opts);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async makeRequest(URL: string, opts: any): Promise<K8SRawResponse> {
    try {
      const fetchOptions: RequestInit = {
        method: opts.method || 'GET',
        headers: opts.headers || {},
      };

      // Configure HTTPS agent if cert/key/ca are provided
      if (opts.cert || opts.key || opts.ca || opts.agentOptions) {
        const agentOptions: any = opts.agentOptions || {};
        if (opts.cert) agentOptions.cert = opts.cert;
        if (opts.key) agentOptions.key = opts.key;
        if (opts.ca) agentOptions.ca = opts.ca;
        if (opts.strictSSL !== undefined) agentOptions.rejectUnauthorized = opts.strictSSL;

        // @ts-ignore - node-fetch accepts agent option
        fetchOptions.agent = new HttpsAgent(agentOptions);
      }

      const response = await fetch(URL, fetchOptions);
      const body = await response.text();

      return {
        statusCode: response.status,
        data: body,
        error: '',
      };
    } catch (error) {
      return {
        statusCode: 0,
        data: '',
        error: String(error),
      };
    }
  }

  getConfig(): KubeConfig {
    return this.k8sConfig;
  }

  makeApiClient<T extends ApiType>(apiClientType: ApiConstructor<T>): T {
    return this.k8sConfig.makeApiClient(apiClientType);
  }

  getCoreApi(): CoreV1Api {
    if (!this.coreV1API) {
      this.k8sConfig.loadFromCluster();
      this.coreV1API = this.k8sConfig.makeApiClient(CoreV1Api);
    }
    return this.coreV1API;
  }

  getCustomObjectsApi(): CustomObjectsApi {
    if (!this.customObjectsApi) {
      this.k8sConfig.loadFromCluster();
      this.customObjectsApi = this.k8sConfig.makeApiClient(CustomObjectsApi);
    }
    return this.customObjectsApi;
  }

  async getSecret(labelSelector?: string): Promise<Array<V1Secret>> {
    const namespace = this.getDevWorkspaceNamespace();
    if (!namespace) {
      throw new Error('Can not get secrets: DEVWORKSPACE_NAMESPACE env variable is not defined');
    }

    try {
      const coreV1API = this.getCoreApi();
      const secretList = await coreV1API.listNamespacedSecret({
        namespace: namespace,
        labelSelector: labelSelector,
      });
      return secretList.items;
    } catch (error) {
      console.error('Can not get secret ', error);
      return [];
    }
  }

  async replaceNamespacedSecret(name: string, secret: V1Secret): Promise<void> {
    const namespace = this.getDevWorkspaceNamespace();
    if (!namespace) {
      throw new Error('Can not replace a secret: DEVWORKSPACE_NAMESPACE env variable is not defined');
    }

    const coreV1API = this.getCoreApi();
    await coreV1API.replaceNamespacedSecret({
      name: name,
      namespace: namespace,
      body: secret,
    });
  }

  async createNamespacedSecret(secret: V1Secret): Promise<void> {
    const namespace = this.getDevWorkspaceNamespace();
    if (!namespace) {
      throw new Error('Can not create a secret: DEVWORKSPACE_NAMESPACE env variable is not defined');
    }

    const coreV1API = this.getCoreApi();
    await coreV1API.createNamespacedSecret({
      namespace: namespace,
      body: secret,
    });
  }

  async deleteNamespacedSecret(secret: V1Secret): Promise<void> {
    const namespace = this.getDevWorkspaceNamespace();
    if (!namespace) {
      throw new Error('Can not delete a secret: DEVWORKSPACE_NAMESPACE env variable is not defined');
    }

    const secretName = secret.metadata?.name;
    if (!secretName) {
      throw new Error('Can not delete a secret: secret name is not defined');
    }

    const coreV1API = this.getCoreApi();
    await coreV1API.deleteNamespacedSecret({
      name: secretName,
      namespace: namespace,
    });
  }

  async getDevWorkspace(): Promise<V1alpha2DevWorkspace> {
    try {
      const workspaceName = this.getDevWorkspaceName();
      const namespace = this.getDevWorkspaceNamespace();
      const customObjectsApi = this.getCustomObjectsApi();

      const resp = await customObjectsApi.getNamespacedCustomObject({
        group: devworkspaceGroup,
        version: devworkspaceLatestVersion,
        namespace: namespace,
        plural: devworkspacePlural,
        name: workspaceName,
      });
      return resp.body as V1alpha2DevWorkspace;
    } catch (e) {
      console.error(e);
      throw new Error('Unable to get Dev Workspace');
    }
  }

  getDevWorkspaceName(): string {
    if (this.devWorkspaceName) {
      return this.devWorkspaceName;
    }

    const workspaceName = process.env.DEVWORKSPACE_NAME;
    if (workspaceName) {
      this.devWorkspaceName = workspaceName;
      return this.devWorkspaceName;
    }

    console.error('Can not get Dev Workspace name: DEVWORKSPACE_NAME env variable is not defined');
    throw new Error('Can not get Dev Workspace name');
  }

  getDevWorkspaceNamespace(): string {
    if (this.devWorkspaceNamespace) {
      return this.devWorkspaceNamespace;
    }

    const workspaceNamespace = process.env.DEVWORKSPACE_NAMESPACE;
    if (workspaceNamespace) {
      this.devWorkspaceNamespace = workspaceNamespace;
      return this.devWorkspaceNamespace;
    }

    console.error('Can not get Dev Workspace namespace: DEVWORKSPACE_NAMESPACE env variable is not defined');
    throw new Error('Can not get Dev Workspace namespace');
  }
}
