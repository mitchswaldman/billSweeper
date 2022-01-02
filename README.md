# Bill-Sweeper

This project crawls the NY state legislature website to pull some info into CSV files.

# How to run
Install dependencies
```
npm install
```

First generate the CSVs:
```
node index.js
```

Then collate them all together
```
node mergeFiles.js
```

# Structure

This project has two main pieces:
1. A script that creates many small CSV files from a list of bill numbers.
2. A script that can merge N csv files together into one big master list.

## index.js

This is the entrypoint that actually kicks off the parallel processes that create the csv files. 

It looks at the `bills` export of the `bills.js` file and will kick off as many child processes as necessary to ingest all the bills using a configurable batch size. For instance, `bills` currently has approx 8500 bill numbers and the default batch size is 100, so `index.js` will kick off 85 (8500/100) parallel processes to create 85 different csv files.

`billScraper.js` is the file that actually does the work of downloading the HTML for a bill and parsing the information out of it. 

## mergeFiles.js

After you run `index.js` and generate the CSV files, run `mergeFiles.js` to get all the data collated into one big file. 
