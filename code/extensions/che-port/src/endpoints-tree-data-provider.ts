/**********************************************************************
 * Copyright (c) 2022 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

/* eslint-disable header/header */

import * as path from 'path';
import * as vscode from 'vscode';

import { Endpoint } from './endpoint';
import { EndpointCategory } from './endpoint-category';
import { EndpointExposure } from './endpoint-exposure';
import { ListeningPort } from './listening-port';

// available context values used in package.json to assign context menus
export type EndpointTreeNodeItemContext =
  | 'publicHttpsEndpointOnline'
  | 'publicHttpEndpointOnline'
  | 'publicHttpPortOnline'
  | 'publicPortOnline'
  | 'publicDevfilePortOffline'
  | 'privateUserPortOnline'
  | 'privateDevfilePortOnline'
  | 'privateDevfilePortOffline';

// defines a custom item by adding the endpoint and parent id.
export interface EndpointTreeNodeItem extends vscode.TreeItem {
  endpoint?: Endpoint;
  parentId?: string;
  // make id and label mandatory
  id: string;
  label: string;
  contextValue?: EndpointTreeNodeItemContext;
}

export class EndpointsTreeDataProvider implements vscode.TreeDataProvider<EndpointTreeNodeItem> {
  private onDidChangeTreeDataEmitter: vscode.EventEmitter<undefined>;
  private ids: string[];
  readonly onDidChangeTreeData: vscode.Event<undefined>;
  private treeNodeItems: EndpointTreeNodeItem[];
  private showPluginEndpoints: boolean;
  private currentEndpoints: Endpoint[];
  private openedPorts: ListeningPort[];
  private treeId: number;

  constructor() {
    this.treeId = 0;
    this.treeNodeItems = [];
    this.currentEndpoints = [];
    this.openedPorts = [];
    this.onDidChangeTreeDataEmitter = new vscode.EventEmitter<undefined>();
    this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    this.ids = [];
    // do not show plugin endpoints by default
    this.showPluginEndpoints = false;
  }

  // Register commands and init context
  async init(context: vscode.ExtensionContext): Promise<void> {
    // custom view
    const endpointsTreeDataProviderDisposable = new vscode.Disposable(() => {
      this.dispose();
    });
    context.subscriptions.push(endpointsTreeDataProviderDisposable);
    const treeView = vscode.window.createTreeView('endpoints', { treeDataProvider: this });

    context.subscriptions.push(
      vscode.commands.registerCommand('portPlugin.filterInPlugins', async () => {
        this.updateContext(treeView, true);
      })
    );
    context.subscriptions.push(
      vscode.commands.registerCommand('portPlugin.filterOutPlugins', async () => {
        this.updateContext(treeView, false);
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('portPlugin.openNewTabPort', (node: EndpointTreeNodeItem) => {
        if (node.endpoint && node.endpoint.url) {
          vscode.env.openExternal(vscode.Uri.parse(node.endpoint.url.toString()));
        }
      })
    );
    context.subscriptions.push(
      vscode.commands.registerCommand('portPlugin.copyClipboardUrl', async (node: EndpointTreeNodeItem) => {
        if (node.endpoint && node.endpoint.url) {
          await vscode.env.clipboard.writeText(node.endpoint.url);
        }
      })
    );
    context.subscriptions.push(
      vscode.commands.registerCommand('portPlugin.preview', (node: EndpointTreeNodeItem) => {
        if (node.endpoint && node.endpoint.url) {
          vscode.commands.executeCommand('simpleBrowser.show', node.endpoint.url);
        }
      })
    );

    // initialize context
    this.updateContext(treeView, true);
  }

  // update global context (like toggle mode for showing plugins)
  async updateContext(_treeView: vscode.TreeView<EndpointTreeNodeItem>, showPluginEndpoints: boolean): Promise<void> {
    this.showPluginEndpoints = showPluginEndpoints;
    // change context for the toggle icon
    vscode.commands.executeCommand('setContext', 'portPluginShowPlugins', this.showPluginEndpoints);
    // refresh tree
    this.refresh();
  }

  // Update the endpoints from ports-plugin
  async updateEndpoints(currentEndpoints: Endpoint[], openedPorts: ListeningPort[]): Promise<void> {
    this.currentEndpoints = currentEndpoints;
    this.openedPorts = openedPorts;
    this.refresh();
  }

  // helper method to know if a port is online or not
  isOnline(portNumber: number): boolean {
    return this.openedPorts.some(listeningPort => listeningPort.portNumber === portNumber);
  }

  // Create a new node item
  createEndpointTreeNodeItem(label: string, parentId: string, endpoint: Endpoint): EndpointTreeNodeItem {
    return {
      id: this.getNextId(),
      label,
      parentId,
      endpoint,
    };
  }

  async refresh(): Promise<void> {
    let filteredEndpoints = [...this.currentEndpoints];
    if (!this.showPluginEndpoints) {
      filteredEndpoints = filteredEndpoints.filter(endpoint => endpoint.category === EndpointCategory.USER);
    }

    this.ids.length = 0;
    this.treeNodeItems.length = 0;

    const publicEndpointsGroup: EndpointTreeNodeItem = {
      id: this.getNextId(),
      label: 'Public',
      iconPath: {
        light: vscode.Uri.parse(path.join(__filename, '..', '..', 'resources', 'light', 'globe.svg')),
        dark: vscode.Uri.parse(path.join(__filename, '..', '..', 'resources', 'dark', 'globe.svg')),
      },
      tooltip: 'Public endpoints referenced in the devfile',
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    };

    const privateEndpointsGroup: EndpointTreeNodeItem = {
      id: this.getNextId(),
      iconPath: {
        light: vscode.Uri.parse(path.join(__filename, '..', '..', 'resources', 'light', 'home.svg')),
        dark: vscode.Uri.parse(path.join(__filename, '..', '..', 'resources', 'dark', 'home.svg')),
      },
      label: 'Internal',
      tooltip: 'Internal endpoints (only available within workspace)',
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    };

    // public endpoints are:
    //  - the one defined in the devfile
    //  - and the current port forwarding
    const publicEndpoints: Endpoint[] = filteredEndpoints.filter(
      endpoint =>
        endpoint.exposure === EndpointExposure.FROM_DEVFILE_PUBLIC ||
        endpoint.exposure === EndpointExposure.FROM_RUNTIME_PORT_FORWARDING
    );
    publicEndpoints.forEach(endpoint => {
      const targetPort = endpoint.targetPort;
      let label;
      if (endpoint.exposure === EndpointExposure.FROM_RUNTIME_PORT_FORWARDING) {
        label = endpoint.name;
      } else {
        label = `${endpoint.name} (${targetPort}/${endpoint.protocol})`;
      }
      const publicEndpointNode = this.createEndpointTreeNodeItem(label, publicEndpointsGroup.id, endpoint);
      if (this.isOnline(targetPort)) {
        publicEndpointNode.iconPath = 'fa-circle medium-green';
        publicEndpointNode.tooltip = 'Public Port';
        if (endpoint.url && endpoint.url.startsWith('https://')) {
          publicEndpointNode.contextValue = 'publicHttpsEndpointOnline';
        } else if (endpoint.url && endpoint.url.startsWith('http://')) {
          publicEndpointNode.contextValue = 'publicHttpEndpointOnline';
        } else {
          publicEndpointNode.contextValue = 'publicPortOnline';
        }
      } else {
        publicEndpointNode.iconPath = 'fa-circle-thin medium-grey';
        publicEndpointNode.tooltip = 'Public Port offline';
        publicEndpointNode.contextValue = 'publicDevfilePortOffline';
      }
      this.treeNodeItems.push(publicEndpointNode);
    });

    // now, add all listening ports not defined in the devfile.
    // not excluded
    // not ephemeral
    const privateEndpoints: Endpoint[] = filteredEndpoints.filter(
      endpoint =>
        endpoint.exposure === EndpointExposure.FROM_DEVFILE_PRIVATE ||
        endpoint.exposure === EndpointExposure.FROM_RUNTIME_USER
    );
    privateEndpoints.forEach(endpoint => {
      const privateEndpointNode = this.createEndpointTreeNodeItem(
        `${endpoint.name} (${endpoint.targetPort}/${endpoint.protocol})`,
        privateEndpointsGroup.id,
        endpoint
      );
      if (this.isOnline(endpoint.targetPort)) {
        privateEndpointNode.iconPath = 'fa-circle medium-green';
        privateEndpointNode.tooltip = 'Private Port';
        // user defined ?
        if (endpoint.exposure === EndpointExposure.FROM_RUNTIME_USER) {
          privateEndpointNode.contextValue = 'privateUserPortOnline';
        } else {
          privateEndpointNode.contextValue = 'privateDevfilePortOnline';
        }
      } else {
        privateEndpointNode.iconPath = 'fa-circle-thin medium-grey';
        privateEndpointNode.tooltip = 'Private Port offline';
        privateEndpointNode.contextValue = 'privateDevfilePortOffline';
      }
      this.treeNodeItems.push(privateEndpointNode);
    });

    // sort per labels
    this.treeNodeItems.sort((item1: EndpointTreeNodeItem, item2: EndpointTreeNodeItem) =>
      item1.label.localeCompare(item2.label)
    );

    // add the root elements only if there are elements to display
    if (publicEndpoints.length > 0) {
      this.treeNodeItems.push(publicEndpointsGroup);
    }
    if (privateEndpoints.length > 0) {
      this.treeNodeItems.push(privateEndpointsGroup);
    }
    if (privateEndpoints.length === 0 && publicEndpoints.length === 0) {
      this.treeNodeItems.push({
        id: this.getNextId(),
        label: 'No endpoints',
        iconPath: 'fa-times-circle',
        tooltip: 'No endpoints',
        collapsibleState: vscode.TreeItemCollapsibleState.None,
      });
    }
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  private getNextId(): string {
    return `${this.treeId++}`;
  }

  getChildren(element?: EndpointTreeNodeItem | undefined): vscode.ProviderResult<EndpointTreeNodeItem[]> {
    if (element) {
      return this.treeNodeItems.filter(item => item.parentId === element.id);
    } else {
      return this.treeNodeItems.filter(item => item.parentId === undefined);
    }
  }

  getTreeItem(element: EndpointTreeNodeItem): vscode.TreeItem {
    return element;
  }

  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
  }
}
