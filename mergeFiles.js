// merge the output csv files together
import fs from 'fs';
import glob from 'glob';
import csv from 'fast-csv';
import path, {dirname} from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

glob("output_*.csv", (er, matches) => {
    matches = matches.sort((a, b) => {
        const a_number = parseInt(a.match(/\d+/)[0], 10);
        const b_number = parseInt(b.match(/\d+/)[0], 10);
        return a_number - b_number;
    })
    concatCSVAndOutput(matches, "allOutput.csv")
})

function concatCSVAndOutput(csvFilePaths, outputFilePath) {
    const promises = csvFilePaths.map((path) => {
        return new Promise((resolve) => {
        const dataArray = [];
        return csv
            .parseFile(path, {headers: true})
            .on('data', function(data) {
                dataArray.push(data);
            })
            .on('end', function() {
                resolve(dataArray);
            });
        });
    });
    
    return Promise.all(promises)
        .then((results) => {
    
            const csvStream = csv.format({headers: true});
            const writableStream = fs.createWriteStream(outputFilePath);
    
            writableStream.on('finish', function() {
            console.log('DONE!');
            });
    
            csvStream.pipe(writableStream);
            results.forEach((result) => {
            result.forEach((data) => {
                csvStream.write(data);
            });
            });
            csvStream.end();
    
        });
}