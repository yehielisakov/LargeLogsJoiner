import { StreamBasedLogMerger } from "./stream-based-log-merger";
import { ReadStream, WriteStream } from "fs";
import * as fs from "fs";
import { ILogMerger } from "./interfaces";
import {LineReaderBasedLogMerger} from "./line-reader-based-log-merger";

const rootDir: string = '/Users/yehiel/Downloads/Exercise/input/';
const filesNames: string[] = ['from_3000.log', 'reg1.log', 'reg2.log', 'sparse.log', 'until_500.log'];
const files: string[] = [];
filesNames.forEach(f => files.push(rootDir + f))
const inputStreams: ReadStream[] = [];
files.forEach(file => inputStreams.push(fs.createReadStream(file)));

// const targetFile: string = rootDir + 'merge_result.log';
// const outputStream: WriteStream = fs.createWriteStream(targetFile);
// const merger: ILogMerger = new StreamBasedLogMerger(inputStreams, outputStream);
//
// merger.mergeLogs()
//     .then(() => console.log("Done merging"))
//     .catch((err) => console.log(err));

const otherTargetFile: string = rootDir + 'merge_result_two.log';
const otherOutputStream: WriteStream = fs.createWriteStream(otherTargetFile);
const otherMerger: ILogMerger = new LineReaderBasedLogMerger(inputStreams, otherOutputStream);
otherMerger.mergeLogs()
    .then(() => console.log("Done merging"))
    .catch((err) => console.log(err));
