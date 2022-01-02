import got from 'got'
import fs from 'fs'
import jsdom from 'jsdom'
const { JSDOM } = jsdom;

import bills from './bills.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv)).argv

const filename = argv.output || 'output.csv';
const batch = argv.batch || 50;
const offset = argv.offset || 0;

console.info("Running with config", {filename, batch, offset});

function writeToCSVFile(data) {
  fs.writeFile(filename, extractAsCSV(data), err => {
    if (err) {
      console.log('Error writing to csv file', err);
    } else {
      console.log(`saved as ${filename}`);
    }
  });
}

function extractAsCSV(data) {
  const firstRow = data[0];
  const headers = Object.keys(firstRow);
  console.log("DEBUG", headers)
  const rows = data.map(row => {
     return stringifyArray(headers.map(header => row[header]))
  });
  const headersStr = stringifyArray(headers)
  return headersStr + "\n" + rows.join("\n");
}

function stringifyArray(row) {
  return row.map(cell => escapeCell(cell)).join(",")
}

function escapeCell(cell = "") {
  try {
  return `"${(cell + "").replace(/"/g, '""')}"`
  } catch (err) {
    console.log("Cell error:", cell)
    throw err 
  }
}

const BASE_URL = "https://nyassembly.gov/leg/?default_fld=&leg_video=&term=&Summary=Y&Actions=Y";

const getUrlForBill = (bill) => `${BASE_URL}&bn=${bill}`;

(async () => {
  
  let billRows = [];
  
  const partitionedBills = bills.splice(offset, batch)

  for (const bill of partitionedBills) {
    let dom;
    try {
      const response = await got(getUrlForBill(bill));
      dom = new JSDOM(response.body);
      console.log(dom.window.document.querySelector('title').textContent);
    } catch (err) {
      console.error(err)
    }
    const document = dom.window.document;
    let result = "noop";
    try {
      const summaryTableEl = document.querySelector("#legcontent > table:nth-child(8)")
      
      if (!summaryTableEl) {
        result = 'summaryTable';
      }
      const billNoEl = summaryTableEl.querySelector('tbody tr:first-child td:nth-child(2)')
      if (!billNoEl) {
        result = "billNo"
      }
      const sponsorEl = summaryTableEl.querySelector('tbody tr:nth-child(5) td:nth-child(2)')
      if (!sponsorEl) result = "sponsor"

      const cosponsorEl = summaryTableEl.querySelector('tbody tr:nth-child(7) td:nth-child(2)')
      if (!cosponsorEl) result = 'cosponsor'

      const summaryEl = summaryTableEl.querySelector('tbody tr:last-child td')
      if (!summaryEl) result = 'summary'

      const billActionsTableEl = document.querySelector("#legcontent > table:nth-child(12)")
      
      if (!billActionsTableEl) {
        result = 'billActionsTable';
      }
      const committeeEl = billActionsTableEl.querySelector('tbody tr:nth-child(3) td:nth-child(2)');
      if (!committeeEl) result = 'committee'

      console.log("Bill actions td elems", billActionsTableEl.querySelectorAll('td'))
      const passedAssembly = [...billActionsTableEl.querySelectorAll('td')].some(el => el.textContent.indexOf("passed ass") > -1)
      result = {
        billNo: billNoEl.textContent,
        sponsor: sponsorEl.textContent,
        cosponsor: cosponsorEl.textContent,
        summary: summaryEl.textContent,
        committee: committeeEl.textContent.substring(12),
        passedAssembly
      }
    } catch (err) {
      console.error("encountered error while parsing page for bill: ", bill);
      console.error(err)
      continue
    }
    
    
    if (typeof result === 'string') {
      console.error("Error parsing page for bill ", bill);
      console.error("Could not find element for: ", result);
      continue
    }

    billRows = billRows.concat(result)
    console.log("Found bill no:", result.billNo)
  }
  writeToCSVFile(billRows)
})();