/**********************************************************************
 * Copyright (c) 2024-2025 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

import { env } from 'process';
import * as fs from '../src/fs-extra';
import { EditorConfigurations } from '../src/editor-configurations';

const DEVWORKSPACE_NAMESPACE = 'test-namespace';
const REMOTE_SETTINGS_PATH = '/checode/remote/data/Machine/settings.json';
const WORKSPACE_FILE_PATH = '/projects/.code-workspace';
const WORKSPACE_FILE_CONTENT =
  '{\n' +
  '  "folders": [\n' +
  '    {\n' +
  '      "name": "code",\n' +
  '      "path": "/code"\n' +
  '    }\n' +
  '  ]\n' +
  '}\n';
const WORKSPACE_FILE_INCORRECT_CONTENT = '{//not valid JSON here}';
const SETTINGS_CONTENT =
  '{\n' +
  '  "window.header": "SOME MESSAGE",\n' +
  '  "workbench.colorCustomizations": {\n' +
  '    "titleBar.activeBackground": "#CCA700",\n' +
  '    "titleBar.activeForeground": "#151515"\n' +
  '  }\n' +
  '}\n';
const REMOTE_SETTINGS_FILE_CONTENT = '{\n' + '"window.commandCenter": false\n' + '}\n';
const SETTINGS_JSON = JSON.parse(SETTINGS_CONTENT);
const SETTINGS_TO_FILE = JSON.stringify(SETTINGS_JSON, null, '\t');
// const CONFIGMAP_SETTINGS_DATA = {
//   'settings.json': SETTINGS_CONTENT,
// };

const EXTENSIONS_CONTENT =
  '{\n' +
  '  "recommendations": [\n' +
  '      "dbaeumer.vscode-eslint",\n' +
  '      "github.vscode-pull-request-github"\n' +
  '  ]\n' +
  '}\n';
const EXTENSIONS_JSON = JSON.parse(EXTENSIONS_CONTENT);
const WORKSPACE_CONFIG_JSON = JSON.parse(WORKSPACE_FILE_CONTENT);
WORKSPACE_CONFIG_JSON['extensions'] = EXTENSIONS_JSON;
const WORKSPACE_CONFIG_WITH_EXTENSIONS_TO_FILE = JSON.stringify(WORKSPACE_CONFIG_JSON, null, '\t');
// const CONFIGMAP_EXTENSIOSN_DATA = {
//   'extensions.json': EXTENSIONS_CONTENT,
// };

// const CONFIGMAP_INCORRECT_DATA = {
//   'extensions.json': '//some incorrect data',
//   'settings.json': '//some incorrect data',
// };

jest.mock('@kubernetes/client-node', () => {
  const actual = jest.requireActual('@kubernetes/client-node');
  return {
    ...actual,
    KubeConfig: jest.fn().mockImplementation(() => {
      return {
        loadFromCluster: jest.fn(),
        makeApiClient: jest.fn(),
      };
    }),
    CoreV1Api: jest.fn(),
  };
});

describe('Test applying editor configurations:', () => {
  const fileExistsMock = jest.fn();
  const writeFileMock = jest.fn();
  const readFileMock = jest.fn();

  Object.assign(fs, {
    fileExists: fileExistsMock,
    writeFile: writeFileMock,
    readFile: readFileMock,
  });

  beforeEach(() => {
    delete env.DEVWORKSPACE_NAMESPACE;
    jest.clearAllMocks();
  });

  it('should skip applying editor congis if there is no DEVWORKSPACE_NAMESPACE', async () => {
    await new EditorConfigurations().configure();

    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('should skip applying configs when request for a configmap is failed', async () => {
    env.DEVWORKSPACE_NAMESPACE = DEVWORKSPACE_NAMESPACE;

    await new EditorConfigurations(WORKSPACE_FILE_PATH).configure();

    expect(fileExistsMock).not.toHaveBeenCalled(); // no sense to read files if we have no configmap content
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('should skip applying configs when incorrect data in a configmap', async () => {
    env.DEVWORKSPACE_NAMESPACE = DEVWORKSPACE_NAMESPACE;
    fileExistsMock.mockResolvedValue(false);

    await new EditorConfigurations(WORKSPACE_FILE_PATH).configure();

    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('should apply settings from a configmap', async () => {
    env.DEVWORKSPACE_NAMESPACE = DEVWORKSPACE_NAMESPACE;

    fileExistsMock.mockResolvedValue(false);

    await new EditorConfigurations().configure();

    expect(writeFileMock).toBeCalledTimes(1); // only settings were applied
    expect(writeFileMock).toBeCalledWith(REMOTE_SETTINGS_PATH, SETTINGS_TO_FILE);
  });

  it('should merge settings from a configmap with existing one', async () => {
    env.DEVWORKSPACE_NAMESPACE = DEVWORKSPACE_NAMESPACE;

    fileExistsMock.mockResolvedValue(true);
    readFileMock.mockResolvedValue(REMOTE_SETTINGS_FILE_CONTENT);
    const existingSettingsJson = JSON.parse(REMOTE_SETTINGS_FILE_CONTENT);
    const mergedSettings = { ...existingSettingsJson, ...SETTINGS_JSON };
    const mergedSettingsToFile = JSON.stringify(mergedSettings, null, '\t');

    await new EditorConfigurations().configure();

    expect(writeFileMock).toBeCalledTimes(1);
    expect(writeFileMock).toBeCalledWith(REMOTE_SETTINGS_PATH, mergedSettingsToFile);
  });

  it('should skip applying extensions when incorrect data in the workspace file', async () => {
    env.DEVWORKSPACE_NAMESPACE = DEVWORKSPACE_NAMESPACE;
    fileExistsMock.mockResolvedValue(true);
    readFileMock.mockResolvedValue(WORKSPACE_FILE_INCORRECT_CONTENT);

    await new EditorConfigurations(WORKSPACE_FILE_PATH).configure();

    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('should skip applying extensions when the workspace file is not found', async () => {
    env.DEVWORKSPACE_NAMESPACE = DEVWORKSPACE_NAMESPACE;
    fileExistsMock.mockResolvedValue(true);

    await new EditorConfigurations().configure();

    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('should apply extensions from a configmap', async () => {
    env.DEVWORKSPACE_NAMESPACE = DEVWORKSPACE_NAMESPACE;
    fileExistsMock.mockResolvedValue(true);
    readFileMock.mockResolvedValue(WORKSPACE_FILE_CONTENT);

    await new EditorConfigurations(WORKSPACE_FILE_PATH).configure();

    expect(writeFileMock).toBeCalledTimes(1); // only extensions were applied
    expect(writeFileMock).toBeCalledWith(WORKSPACE_FILE_PATH, WORKSPACE_CONFIG_WITH_EXTENSIONS_TO_FILE);
  });

  it('should merge product.json with a provided config map', async () => {
    env.DEVWORKSPACE_NAMESPACE = DEVWORKSPACE_NAMESPACE;

    const existingProductJSON = `{
      "nameShort": "CheCode",
      "extensionEnabledApiProposals": {
        "vgulyy.console-writer": [
          "terminalDataWriteEvent",
          "terminalExecuteCommandEvent"
        ]
      },
      "extensionsGallery": {
        "serviceUrl": "https://openvsix.org/extensions/gallery",
        "itemUrl": "https://openvsix.org/extensions/items"
      },
      "apiVersion": 1
    }`;

    // const configmap = {
    //   'product.json': `{
    //     "extensionEnabledApiProposals": {
    //       "ms-python.python": [
    //         "contribEditorContentMenu",
    //         "quickPickSortByLabel"
    //       ],
    //       "vgulyy.console-writer": [
    //         "terminalCoolors",
    //         "terminalCharacters"
    //       ]
    //     },
    //     "extensionsGallery": {
    //       "serviceUrl": "https://marketplace/gallery",
    //       "itemUrl": "https://marketplace/items"
    //     },
    //     "trustedExtensionAuthAccess": [
    //       "thepublisher.say-hello"
    //     ],
    //     "apiVersion": 2
    //   }`,
    // };

    const mergedProductJSON = `{
      "nameShort": "CheCode",
      "extensionEnabledApiProposals": {
        "vgulyy.console-writer": [
          "terminalDataWriteEvent",
          "terminalExecuteCommandEvent",
          "terminalCoolors",
          "terminalCharacters"
        ],
        "ms-python.python": [
          "contribEditorContentMenu",
          "quickPickSortByLabel"
        ]
      },
      "extensionsGallery": {
        "serviceUrl": "https://marketplace/gallery",
        "itemUrl": "https://marketplace/items"
      },
      "apiVersion": 2,
      "trustedExtensionAuthAccess": [
        "thepublisher.say-hello"
      ]
    }`;

    readFileMock.mockImplementation(async (path) => {
      if ('product.json' === path) {
        return existingProductJSON;
      }
    });

    await new EditorConfigurations(WORKSPACE_FILE_PATH).configure();

    expect(writeFileMock).toBeCalledTimes(1);
    expect(writeFileMock).toHaveBeenCalledWith(
      'product.json',
      JSON.stringify(JSON.parse(mergedProductJSON), null, '\t')
    );
  });
});
