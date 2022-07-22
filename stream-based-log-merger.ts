import { ILogMerger } from "./interfaces";
import { ReadStream, WriteStream } from "fs";

export class StreamBasedLogMerger implements ILogMerger {
    private _inputStreams: Map<string | Buffer, ReadStream>;
    private _chunks: Map<string | Buffer, string[]>;
    private readonly DEFAULT_NUM_OF_LINES_IN_CHUNK: number = 100;
    private _outputStream: WriteStream;
    private _isInitialized: boolean;
    private readonly _props: any = {};

    constructor(inputStreams: ReadStream[], outputStream: WriteStream, props: any = {}) {
        this._inputStreams = new Map<string | Buffer, ReadStream>();
        inputStreams.forEach(inputStream => this._inputStreams.set(inputStream.path, inputStream));
        this._outputStream = outputStream;
        this._props = props;
    }

    private async initialize() {
        if (!this._isInitialized) {
            this._chunks = new Map<string, string[]>();
            const inputStreamsArray: ReadStream[] = Array.from(this._inputStreams.values());
            await Promise.all(inputStreamsArray.map(async (inputStream) => {
                let chunk: string[] = await this.readChunkOfLines(inputStream, this._props);
                this._chunks.set(inputStream.path, chunk);
            }));
            this._isInitialized = true;
        }
    }

    private async readChunkOfLines(inputStream: ReadStream, numOfLines: number): Promise<string[]> {
        return new Promise((resolve, reject) => {
            try {
                    const lines: string[] = [];
                    let remaining = '';
                    if (inputStream.destroyed || inputStream.closed) {
                        resolve(lines);
                    }
                    if (inputStream.isPaused()) {
                        inputStream.resume();
                    }

                    inputStream.on('data', data  => {
                        remaining += data;
                        let index = remaining.indexOf('\n');
                        while (index > -1) {
                            let line = remaining.substring(0, index);
                            if (line?.length > 0 && line?.trim()?.length > 0) {
                                lines.push(line?.trim());
                            }
                            if (lines.length === numOfLines) {
                                inputStream.pause();
                                resolve(lines);
                            }
                            remaining = remaining.substring(index + 1);
                            index = remaining.indexOf('\n');
                        }
                        if (remaining?.length > 0) {
                            lines.push(remaining);
                        }
                    });

                    inputStream.on('end', () => {
                        inputStream.on('close', () => {
                            console.log(`Filestream ${inputStream.path} closed`);
                        });
                        resolve(lines);
                    });
                    inputStream.on('error', (err: Error) => reject(err));
                }
            catch (err) {
                reject(err);
            }
        });
    }

    private getTimestamp(line: string): number {
        const splitResult: string[] = line.split('>');
        const timestampString: string = splitResult[0].replace('<', "");
        return Number(timestampString);
    }

    private async checkChunk(inputStreamPath: string | Buffer): Promise<void> {
        const inputStream: ReadStream = this._inputStreams.get(inputStreamPath);
        const numOfLines: number = this._props.numOfLines ? Number(this._props.numOfLines) : this.DEFAULT_NUM_OF_LINES_IN_CHUNK;
        const nextChunk: string[] = await this.readChunkOfLines(inputStream, numOfLines);
        if (nextChunk.length === 0) {
            console.log(`Done with file ${inputStreamPath}`);
            this._chunks.delete(inputStreamPath);
            return;
        }
        this._chunks.set(inputStreamPath, nextChunk);
    }

    private findChunkWithMinTimestamp(): string | Buffer {
        let minTimeStamp: number = Number.MAX_SAFE_INTEGER
        let inputStreamPathWithMinTimestamp: string | Buffer = "";
        this._chunks.forEach((chunk, inputStreamPath, chunks) => {
            let timeStamp: number = this.getTimestamp(chunk[0]);
            if (timeStamp <= minTimeStamp) {
                minTimeStamp = timeStamp;
                inputStreamPathWithMinTimestamp = inputStreamPath;
            }
        });
        return inputStreamPathWithMinTimestamp;
    }

    private isAnyChunkNotEmpty(): boolean {
        let values = Array.from(this._chunks.values());
        for (let i = 0; i < values.length; i++) {
            if (values[i].length > 0) {
                return true;
            }
        }
        return false;
    }

    public async mergeLogs(): Promise<void> {
        await this.initialize();
        while (this.isAnyChunkNotEmpty()) {
            let inputStreamPath: string | Buffer = this.findChunkWithMinTimestamp();
            let line: string = this._chunks.get(inputStreamPath)[0];
            this._outputStream.write(line + '\n');
            this._chunks.get(inputStreamPath).splice(0, 1);
            if (this._chunks.get(inputStreamPath).length === 0) {
                console.log(`Get next chunk for ${inputStreamPath} ...`);
                await this.checkChunk(inputStreamPath);
                console.log(`Done getting next chunk for ${inputStreamPath} ...`);
            }
        }
    }
}
