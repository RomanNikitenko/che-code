/**********************************************************************
 * Copyright (c) 2023 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

import { env } from 'process';
import * as fs from '../src/fs-extra';
import { NodeExtraCertificate } from '../src/node-extra-certificate';

describe('Test generating Node Extra Certificate:', () => {
  beforeEach(() => {
    delete env.NODE_EXTRA_CA_CERTS;

    Object.assign(fs, {
      pathExists: jest.fn(),
      isFile: jest.fn(),
      readdir: jest.fn(),
      mkdir: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
    });
  });

  test('should skip if Node extra certificate is already exist', async () => {
    const pathExistsMock = jest.fn();
    Object.assign(fs, {
      pathExists: pathExistsMock,
    });

    pathExistsMock.mockImplementation(async (path: string) => {
      return '/tmp/node-extra-certificates/ca.crt' === path;
    });

    await new NodeExtraCertificate().configure();

    expect(pathExistsMock).toBeCalledTimes(1);
    expect(pathExistsMock).toBeCalledWith('/tmp/node-extra-certificates/ca.crt');
  });

  test('should skip if NODE_EXTRA_CA_CERTS environment variable is already defined', async () => {
    env.NODE_EXTRA_CA_CERTS = '/tmp/user.crt';

    const pathExistsMock = jest.fn();
    Object.assign(fs, {
      pathExists: pathExistsMock,
    });

    await new NodeExtraCertificate().configure();

    expect(pathExistsMock).not.toBeCalled();
  });

  test('should not create a bundle if nothing found', async () => {
    const pathExistsMock = jest.fn();
    const mkdirMock = jest.fn();
    const writeFileMock = jest.fn();

    Object.assign(fs, {
      pathExists: pathExistsMock,
      mkdir: mkdirMock,
      writeFile: writeFileMock,
    });

    pathExistsMock.mockImplementation(async (path: string) => {
      // return false for all files
      return false;
    });

    await new NodeExtraCertificate().configure();

    expect(pathExistsMock).toBeCalledTimes(4);

    expect(pathExistsMock).toBeCalledWith('/tmp/node-extra-certificates/ca.crt');
    expect(pathExistsMock).toBeCalledWith('/tmp/che/secret/ca.crt');
    expect(pathExistsMock).toBeCalledWith('/public-certs');

    expect(mkdirMock).toBeCalledTimes(0);
    expect(writeFileMock).toBeCalledTimes(0);
  });

  test('should create a bundle containing only Che custom certificate', async () => {
    const pathExistsMock = jest.fn();
    const mkdirMock = jest.fn();
    const writeFileMock = jest.fn();
    const readFileMock = jest.fn();

    Object.assign(fs, {
      pathExists: pathExistsMock,
      mkdir: mkdirMock,
      writeFile: writeFileMock,
      readFile: readFileMock,
    });

    pathExistsMock.mockImplementation(async (path: string) => {
      switch (path) {
        case '/tmp/che/secret/ca.crt':
          return true;
      }

      return false;
    });

    readFileMock.mockImplementation(async (file: string) => {
      switch (file) {
        case '/tmp/che/secret/ca.crt':
          return 'custom-che-certificate';
      }
    });

    let test;
    writeFileMock.mockImplementation(async (file: string, data: string) => {
      console.log(`> writeFileMock ${data}`);
      test = data;
    });

    await new NodeExtraCertificate().configure();

    expect(pathExistsMock).toBeCalledTimes(4);
    expect(mkdirMock).toBeCalled();
    expect(writeFileMock).toBeCalledTimes(1);

    expect(test).toBe('custom-che-certificate\n');
  });

  test('should create a bundle containing only public certificates', async () => {
    const pathExistsMock = jest.fn();
    const readdirMock = jest.fn();
    const isFileMock = jest.fn();
    const mkdirMock = jest.fn();
    const writeFileMock = jest.fn();
    const readFileMock = jest.fn();

    Object.assign(fs, {
      pathExists: pathExistsMock,
      readdir: readdirMock,
      isFile: isFileMock,
      mkdir: mkdirMock,
      writeFile: writeFileMock,
      readFile: readFileMock,
    });

    pathExistsMock.mockImplementation(async (path: string) => {
      return '/public-certs' === path;
    });

    readdirMock.mockImplementation(async (dir) => {
      return ['first-key', 'second-key'];
    });

    isFileMock.mockImplementation(async (file) => true);

    readFileMock.mockImplementation(async (file: string) => {
      switch (file) {
        case '/public-certs/first-key':
          return 'first-certificate\n';
        case '/public-certs/second-key':
          return 'second-certificate\n';
      }
    });

    let test;
    writeFileMock.mockImplementation(async (file: string, data: string) => {
      test = data;
    });

    await new NodeExtraCertificate().configure();

    expect(pathExistsMock).toBeCalledTimes(4);
    expect(mkdirMock).toBeCalled();
    expect(writeFileMock).toBeCalledTimes(1);

    expect(test).toBe('first-certificate\nsecond-certificate\n');
  });

  test('should create a bundle containing tls-ca-bundle.pem certificate, custom Che certificate and all public certificates', async () => {
    const pathExistsMock = jest.fn();
    const readdirMock = jest.fn();
    const isFileMock = jest.fn();
    const mkdirMock = jest.fn();
    const writeFileMock = jest.fn();
    const readFileMock = jest.fn();

    Object.assign(fs, {
      pathExists: pathExistsMock,
      readdir: readdirMock,
      isFile: isFileMock,
      mkdir: mkdirMock,
      writeFile: writeFileMock,
      readFile: readFileMock,
    });

    pathExistsMock.mockImplementation(async (path: string) => {
      return (
        '/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem' === path ||
        '/tmp/che/secret/ca.crt' === path ||
        '/public-certs' === path
      );
    });

    readdirMock.mockImplementation(async (dir) => {
      return ['some-dir', 'first-key', 'second-key', 'another-one-dir', 'third-key'];
    });

    isFileMock.mockImplementation(async (file) => {
      if ('/public-certs/some-dir' === file || '/public-certs/another-one-dir' === file) {
        return false;
      }

      return true;
    });

    readFileMock.mockImplementation(async (file: string) => {
      switch (file) {
        case '/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem':
          return 'tls-ca-bundle';
        case '/tmp/che/secret/ca.crt':
          return 'custom-che-certificate';
        case '/public-certs/first-key':
          return 'first-certificate';
        case '/public-certs/second-key':
          return 'second-certificate';
        case '/public-certs/third-key':
          return 'third-certificate';
      }
    });

    let test;
    writeFileMock.mockImplementation(async (file: string, data: string) => {
      test = data;
    });

    await new NodeExtraCertificate().configure();

    expect(pathExistsMock).toBeCalledTimes(4);
    expect(mkdirMock).toBeCalled();
    expect(writeFileMock).toBeCalledTimes(1);

    expect(test).toBe(
      'tls-ca-bundle\ncustom-che-certificate\nfirst-certificate\nsecond-certificate\nthird-certificate\n'
    );
  });
});
