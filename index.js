const puppeteer = require('puppeteer');
const fs = require('fs');
const {bills} = require('./bills');
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

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
  return headers + "\n" + rows.join("\n");
}

function stringifyArray(row) {
  return row.map(cell => escapeCell(cell)).join(",")
}

function escapeCell(cell) {
  return `"${cell}"`
}

function executeWithRetry(fn) {
  return _executeWithRetry(fn, 0)
}


function _executeWithRetry(fn, curAttempt) {
  const MAX_ATTEMPTS = 5;
  if (curAttempt > MAX_ATTEMPTS) {
    throw new Error('Exceeded max attempts whilst trying function: ', fn)
  }
  try {
    return fn()
  } catch (err) {
    console.error("Encountered error: ", err)
    console.info("Retrying. Attempt number: ", curAttempt + 1)
    _executeWithRetry(fn, curAttempt + 1)
  }
}

const BASE_URL = "https://nyassembly.gov/leg/?default_fld=&leg_video=&term=&Summary=Y&Actions=Y";

const getUrlForBill = (bill) => `${BASE_URL}&bn=${bill}`;

(async () => {
  
  const browser = await puppeteer.launch();
  let billRows = [];
  
  const partitionedBills = bills.splice(offset, batch)

  for (const bill of partitionedBills) {
    let page;
    try {
      page = await executeWithRetry(() => {
        return browser.newPage();
      });
    } catch (err) {
      console.error("Error encountered while creating new page.", err)
      continue
    }
    
    try {
      await executeWithRetry(() => {
        return page.goto(getUrlForBill(bill))
      })
    } catch (err) {
      console.error("Error encountered while navigating to page.", err)
      await page.close();
      continue;
    }
    
    let result = "noop";
    try {
      result = await page.evaluate(_ => {
      const summaryTableEl = document.querySelector("#legcontent > table:nth-child(8)")

      if (!summaryTableEl) {
        return 'summaryTable';
      }
      const billNoEl = summaryTableEl.querySelector('tbody tr:first-child td:nth-child(2)')
      if (!billNoEl) {
        return "billNo"
      }
      const sponsorEl = summaryTableEl.querySelector('tbody tr:nth-child(5) td:nth-child(2)')
      if (!sponsorEl) return "sponsor"

      const cosponsorEl = summaryTableEl.querySelector('tbody tr:nth-child(7) td:nth-child(2)')
      if (!cosponsorEl) return 'cosponsor'

      const summaryEl = summaryTableEl.querySelector('tbody tr:last-child td')
      if (!summaryEl) return 'summary'

      const billActionsTableEl = document.querySelector("#legcontent > table:nth-child(12)")
      if (!billActionsTableEl) {
        return 'billActionsTable';
      }
      const committeeEl = billActionsTableEl.querySelector('tbody tr:nth-child(3) td:nth-child(2)');
      if (!committeeEl) return 'committee'

      const passedAssembly = [...billActionsTableEl.querySelectorAll('td')].some(el => el.innerText.indexOf("passed ass") > -1)
      return {
        billNo: billNoEl.innerText,
        sponsor: sponsorEl.innerText,
        cosponsor: cosponsorEl.innerText,
        summary: summaryEl.innerText,
        committee: committeeEl.innerText.substring(12),
        passedAssembly
      }
    });
    } catch (err) {
      console.error("encountered error while parsing page for bill: ", bill);
      await page.close();
      continue
    }
    
    
    if (typeof result === 'string') {
      console.error("Error parsing page for bill ", bill);
      console.error("Could not find element for: ", result);
      continue
    }

    billRows = billRows.concat(result)
    console.log("Found bill no:", result.billNo)
    await page.close();
  }
  writeToCSVFile(billRows)
  await browser.close();
})();