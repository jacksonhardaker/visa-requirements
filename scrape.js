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

  const requirementsAll = await getVisaRequrementsObjects(countryLinks);

  const countriesDir = './countries/';
  Object.keys(requirementsAll).forEach(alpha2Code => {
    let countryDir = `${countriesDir}${alpha2Code}`;

    if (!fs.existsSync(countryDir)) {
      fs.mkdirSync(countryDir);
    }

    const jsonData = JSON.stringify(requirementsAll[alpha2Code], null, 4);
    const jsonDataMin = JSON.stringify(requirementsAll[alpha2Code]);
    fs.writeFile(
      `${countryDir}/visaRequirements.json`,
      jsonData,
      'utf8',
      () => {}
    );
    fs.writeFile(
      `${countryDir}/visaRequirements.min.json`,
      jsonDataMin,
      'utf8',
      () => {}
    );
  });

  const jsonData = JSON.stringify(requirementsAll, null, 4);
  const jsonDataMin = JSON.stringify(requirementsAll);
  fs.writeFile('visaRequirementsFull.json', jsonData, 'utf8', () => {});
  fs.writeFile('visaRequirementsFull.min.json', jsonDataMin, 'utf8', () => {});
})();

async function getVisaRequrementsObjects(urls) {
  const visaReq = {};

  for (let i = 0; i < urls.length; i++) {
    console.log(`[Beginning Scrape: ${urls[i]}]`);

    let requirementsObj = await getCountryVisaRequirements(urls[i]);

    let nationality = decodeURIComponent(
      urls[i]
        .replace(/(\/wiki\/Visa_requirements_for_)|(_citizens)/g, '')
        .replace(/_/g, ' ')
    );

    let data = {
      scrapeUrl: urls[i],
      nationality: nationality,
      ...getCountryByNationality(nationality),
      requirements: requirementsObj
    };

    if (data.alpha2Code) {
      visaReq[data.alpha2Code] = data;
    }

    console.log(`[Finished Scrape: ${urls[i]}]`);
  }

  return visaReq;
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
