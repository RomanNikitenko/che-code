/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Parser } from '@vscode/tree-sitter-wasm';
import { Event } from '../../../base/common/event.js';
import { ITextModel } from '../model.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { Range } from '../core/range.js';

export const EDITOR_EXPERIMENTAL_PREFER_TREESITTER = 'editor.experimental.preferTreeSitter';

export const ITreeSitterParserService = createDecorator<ITreeSitterParserService>('treeSitterParserService');

export interface RangeChange {
	newRange: Range;
	oldRangeLength: number;
	newRangeStartOffset: number;
	newRangeEndOffset: number;
}

export interface TreeParseUpdateEvent {
	ranges: RangeChange[] | undefined;
	versionId: number;
}

export interface TreeUpdateEvent {
	textModel: ITextModel;
	ranges: RangeChange[];
	versionId: number;
}

export interface ITreeSitterParserService {
	readonly _serviceBrand: undefined;
	onDidAddLanguage: Event<{ id: string; language: Parser.Language }>;
	getOrInitLanguage(languageId: string): Parser.Language | undefined;
	getParseResult(textModel: ITextModel): ITreeSitterParseResult | undefined;
	getTree(content: string, languageId: string): Promise<Parser.Tree | undefined>;
	onDidUpdateTree: Event<TreeUpdateEvent>;
	/**
	 * For testing purposes so that the time to parse can be measured.
	*/
	getTextModelTreeSitter(model: ITextModel, parseImmediately?: boolean): Promise<ITextModelTreeSitter | undefined>;
}

export interface ITreeSitterParseResult {
	readonly tree: Parser.Tree | undefined;
	readonly language: Parser.Language;
	versionId: number;
}

export interface ITextModelTreeSitter {
	/**
	 * For testing purposes so that the time to parse can be measured.
	 */
	parse(languageId?: string): Promise<ITreeSitterParseResult | undefined>;
	dispose(): void;
}
