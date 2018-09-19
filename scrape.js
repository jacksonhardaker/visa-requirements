const rp = require('request-promise');
const $ = require('cheerio');
const fs = require('fs');
const countries = require('./countries.json');

const wikiBase = 'https://en.wikipedia.org';
const entryPoint =
  '/w/index.php?title=Category:Visa_requirements_by_nationality';

(async function() {
  let entryPointHtml = await rp(`${wikiBase}${entryPoint}`);
  let nextLink = $(
    $(
      'a[title|="Category:Visa requirements by nationality"]',
      entryPointHtml
    )[0]
  ).attr('href');
  let nextPageHtml = await rp(`${wikiBase}${nextLink}`);

  const countryLinks = [
    ...getCountryVisaPageLinks(entryPointHtml),
    ...getCountryVisaPageLinks(nextPageHtml)
  ];

  const requirementsArray = await getVisaRequrementsObjects(countryLinks);

  const jsonData = JSON.stringify(requirementsArray, null, 4);
  const jsonDataMin = JSON.stringify(requirementsArray);
  fs.writeFile('visaRequirements.json', jsonData, 'utf8', () => {});
  fs.writeFile('visaRequirements.min.json', jsonDataMin, 'utf8', () => {});
})();

async function getVisaRequrementsObjects(urls) {
  const visaReqArr = [];

  for (let i = 0; i < urls.length; i++) {
    console.log(`[Beginning Scrape: ${urls[i]}]`);

    let requirementsObj = await getCountryVisaRequirements(urls[i]);

    let nationality = decodeURIComponent(urls[i]
      .replace(/(\/wiki\/Visa_requirements_for_)|(_citizens)/g, '')
      .replace(/_/g, ' '));

    visaReqArr.push({
      scrapeUrl: urls[i],
      nationality: nationality,
      country: getCountryByNationality(nationality),
      requirements: requirementsObj
    });

    console.log(`[Finished Scrape: ${urls[i]}]`);
  }

  return visaReqArr;
}

async function getCountryVisaRequirements(url) {
  const html = await rp(`${wikiBase}${url}`);
  const visaReqObj = {};

  const visaReqTables = $('table.wikitable', html);

  if (visaReqTables.length > 0) {
    const visaReqRows = Array.from($(visaReqTables[0]).find('tr'));

    visaReqRows.forEach(row => {
      let visaReqCells = $(row).find('td');

      let countryName = visaReqCells[0]
        ? $(visaReqCells[0])
            .text()
            .trim()
        : null;
      let status = visaReqCells[1]
        ? $(visaReqCells[1])
            .text()
            .trim()
            .split('[')[0]
        : null;
      let duration = visaReqCells[2]
        ? $(visaReqCells[2])
            .text()
            .trim()
        : null;
      let notes = visaReqCells[3]
        ? $(visaReqCells[3])
            .text()
            .replace(/\[\d+\]/g, '')
            .trim()
        : null;

      if (countryName) {
        visaReqObj[countryName.toLowerCase().replace(/\s/g, '_')] = {
          country: countryName,
          status: status,
          allowedStay: duration,
          notes: notes
        };
      }
    });
  }

  return visaReqObj;
}

function getCountryVisaPageLinks(html) {
  const linksOnly = Array.from($('div.mw-category', html).find('a')).map(
    link => link.attribs.href
  );

  return linksOnly;
}

function getCountryByNationality(nationality) {
  let lowerCaseNationality = nationality.toLowerCase().trim();

  return countries.find(country => {
    let countryShortLower = country.enShortName.toLowerCase().trim();
    let countryNatsLower = country.nationality.toLowerCase().split(',');

    if (lowerCaseNationality === countryShortLower) {
      return country;
    }

    return countryNatsLower.find(nat => nat.trim() === lowerCaseNationality);
  });
}
