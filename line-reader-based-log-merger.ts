import { ILogMerger } from "./interfaces";
import { ReadStream, WriteStream } from "fs";
import LineByLineReader = require("line-by-line");

interface IReadLineResult {
    line: string;
    isEOF: boolean;
}

export class LineReaderBasedLogMerger implements ILogMerger {
    private _inputStreams: Map<string | Buffer, LineByLineReader>;
    private _currentLines: Map<string | Buffer, string>;
    private _outputStream: WriteStream;
    private _isInitialized: boolean;
    private readonly _props: any = {};

    constructor(inputStreams: ReadStream[], outputStream: WriteStream, props: any = {}) {
        this._inputStreams = new Map<string | Buffer, LineByLineReader>();
        this._currentLines = new Map<string | Buffer, string>();
        inputStreams.forEach(inputStream => this._inputStreams.set(inputStream.path,
            new LineByLineReader(inputStream, { encoding: 'utf8', skipEmptyLines: true })));
        this._outputStream = outputStream;
        this._props = props;
    }

    private async initialize(): Promise<void> {
        if (!this._isInitialized) {
            await Promise.all(Array.from(this._inputStreams).map(async (inputStreamAndPath) => {
                let line: string = "";
                const readResult: IReadLineResult = await this.getNextLine(inputStreamAndPath[0], inputStreamAndPath[1]);
                this._currentLines.set(inputStreamAndPath[0], readResult.line);
                if (readResult.isEOF) {
                    return;
                }
            }));
            this._isInitialized = true;
        }
    }

    private async getNextLine(inputStreamPath: string | Buffer, inputStream: LineByLineReader): Promise<IReadLineResult> {
        return new Promise((resolve, reject) => {
            try {
                inputStream.resume();
                inputStream.removeAllListeners(); // take care of module memory leak related to event listeners
                inputStream.on('line', (line)  => {
                    resolve({ line: line, isEOF: false });
                    inputStream.pause();
                });
                inputStream.on('end', () => {
                    inputStream.on('end', () => {
                        console.log(`Filestream ${inputStreamPath} is closed`);
                    });
                    resolve({ line: "", isEOF: true });
                });
                inputStream.on('error', (err: Error) => reject(err));
            }
            catch (err) {
                reject(err);
            }
        });
    }

    private findLineWithMinTimestamp(): string | Buffer {
        let minTimeStamp: number = Number.MAX_SAFE_INTEGER
        let inputStreamPathWithMinTimestamp: string | Buffer = "";
        this._currentLines.forEach((line, inputStreamPath) => {
            let timeStamp: number = this.getTimestamp(line);
            if (timeStamp <= minTimeStamp) {
                minTimeStamp = timeStamp;
                inputStreamPathWithMinTimestamp = inputStreamPath;
            }
        });
        return inputStreamPathWithMinTimestamp;
    }

    private getTimestamp(line: string): number {
        const splitResult: string[] = line.split('>');
        const timestampString: string = splitResult[0].replace('<', "");
        return Number(timestampString);
    }

    private isAnyLineNotEmpty(): boolean {
        let values = Array.from(this._currentLines.values());
        for (let i = 0; i < values.length; i++) {
            if (values[i]?.length > 0) {
                return true;
            }
        }
        return false;
    }

    public async mergeLogs(): Promise<void> {
        await this.initialize();
        while (this.isAnyLineNotEmpty()) {
            let inputStreamPath: string | Buffer = this.findLineWithMinTimestamp();
            let line: string = this._currentLines.get(inputStreamPath);
            this._outputStream.write(line + '\n');
            let readResult: IReadLineResult = await this.getNextLine(inputStreamPath, this._inputStreams.get(inputStreamPath));
            let nextLine: string = readResult.line;
            if (readResult.isEOF) {
                this._currentLines.delete(inputStreamPath);
            }
            else {
                this._currentLines.set(inputStreamPath, nextLine);
            }

        }

    }
}
