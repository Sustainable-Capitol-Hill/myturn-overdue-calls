// Note: have to use ES5(?) syntax/polyfills since we deactivated the V8 JavaScript engine for this project
// See discussion on https://stackoverflow.com/questions/60230776/were-sorry-a-server-error-occurred-while-reading-from-storage-error-code-perm

/**
 * When the spreadsheet opens, add a "Make Calls" item to the menu bar.
 */
function onOpen() {
  const menu = SpreadsheetApp.getUi()
    .createMenu("Make Calls")
    .addItem("Initiate call", "initiateHigherValueCallDialog")
    .addItem("Initiate call for specific item", "initiateFilteredCallDialog");

  // If high-value taxonomies haven't been identified, then there's no distinction
  // between this option and the default "Initiate call" option
  const highValueTaxa = getHighValueTaxa_();
  if (highValueTaxa.length > 0) {
    menu.addItem(
      "Initiate call, including low-value items",
      "initiateCallDialog"
    );
  }

  menu.addToUi();
}

// prettier-ignore
var CALL_OUTCOME_CATEGORIES_ = {
  TALKED_WILL_RETURN: "🗣️ Talked to patron, and they plan to return the item(s)",
  TALKED_WONT_RETURN: "🗣️ Talked to patron, but they won't or can't return the item(s)",
  TALKED_DROPPED: "🗣️ Talked to patron, but they hung up on you or the call dropped",
  TALKED_NOT_CHECKED_OUT: "🗣️ Talked to patron, but they already returned (or never checked out) the item(s); please correct this in MyTurn!",
  VOICEMAIL_LEFT: "☎️ Successfully left a voicemail",
  VOICEMAIL_FULL: "📵 Voicemail full or not functioning",
  FAILED_DISCONNECTED: "📵 Phone number is disconnected or out of service",
  FAILED_WRONG_NUMBER: "📵 Phone number appears to be associated with a different person",
  FAILED_INVALID_NUMBER: "📵 Phone number is incomplete, invalid, or missing",
};

/**
 * Get the name of the parent taxon from MyTurn's item type tree.
 *
 * @param {string} taxonName - The name of the taxon
 * @return {(string|null)} The name of the parent taxon, or null if it is the root of the tree
 */
function getParentTaxonName_(taxonName) {
  const ROOT_TAXON_ID = 1;

  // Not being able to use `let`s or `Array.find` in this JS engine is annoying
  var taxonParentId;
  var parentTaxon;
  MY_TURN_ITEM_TAXONOMY_.forEach(function (taxon) {
    if (taxon.name === taxonName) {
      taxonParentId = taxon.parent;
    }
  });
  MY_TURN_ITEM_TAXONOMY_.forEach(function (taxon) {
    if (taxon.id === taxonParentId) {
      parentTaxon = taxon;
    }
  });

  if (parentTaxon && parentTaxon.id !== ROOT_TAXON_ID) {
    return parentTaxon.name;
  } else {
    return null;
  }
}

/**
 * Returns a random item from an array.
 *
 * @param {Array} items The array to select a random item from
 * @return {*} A random item from the array
 */
function getRandomItemFromArray_(items) {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Parses rows of spreadsheet data into an array of objects, using the provided headers as keys.
 *
 * @param {string[]} headers The spreadsheet's header row
 * @param {Array[]} rows The rows of data
 * @return {Object[]} An array of objects representing the spreadsheet rows
 */
function parseRowsIntoObjects_(headers, rows) {
  return rows.map(function (row) {
    const rowObject = {};

    row.map(function (value, index) {
      const header = headers[index];
      rowObject[header] = value;
    });

    return rowObject;
  });
}

/**
 * Insert a new row to the call log sheet, with the outcome of a call. This has
 * to be a separate function from `insertCallsMadeRow_` because it is called
 * directly from the HTML form.
 *
 * @param {Object} formObject - The outcome of the call
 * @param {string} formObject.username - The username who was called
 * @param {string} formObject.outcomeCategory - The type of outcome
 * @param {string} formObject.outcomeNotes - Additional notes about the call
 */
function processCallForm_(formObject) {
  insertCallsMadeRow_(
    // This should be in the same time zone as the user's spreadsheet
    new Date().toLocaleDateString("en-US"),
    formObject.username,
    formObject.outcomeCategory,
    formObject.outcomeNotes
  );
}

/**
 * Insert a new row to the call log sheet, with the outcome of a call.
 *
 * @param {string} date - The datetime of the call
 * @param {string} username - The username who was called
 * @param {string} outcomeCategory - The type of outcome
 * @param {string} outcomeNotes - Additional notes about the call
 */
function insertCallsMadeRow_(date, username, outcomeCategory, outcomeNotes) {
  const callsSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log of Calls Made");
  const callsColumnCount = callsSheet.getMaxColumns();
  callsSheet.insertRowAfter(1);
  callsSheet
    .getRange(2, 1, 1, callsColumnCount)
    .setValues([[date, username, outcomeCategory, outcomeNotes]]);
}

/**
 * Fetch all users with overdue items from the spreadsheet.
 *
 * @returns {Object[]} A set of users who have overdue items
 */
function getAllOverdueUsers_() {
  const usersToCallSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    "Users with Overdue Items"
  );
  const usersToCallColumnCount = usersToCallSheet.getMaxColumns();
  const usersToCallHeaders = usersToCallSheet
    .getRange(1, 1, 1, usersToCallColumnCount)
    .getValues()[0];
  const usersToCallRows = usersToCallSheet
    .getRange(2, 1, usersToCallSheet.getMaxRows() - 1, usersToCallColumnCount)
    .getValues()
    .filter(function (i) {
      return Boolean(i[0]);
    });
  const usersToCall = parseRowsIntoObjects_(
    usersToCallHeaders,
    usersToCallRows
  );

  return usersToCall;
}

/**
 * Reads the configuration spreadsheet for what types of items are considered high-value.
 *
 * @returns {string[]} The list of item types prioritized in the configuration
 */
function getHighValueTaxa_() {
  const highValueTaxaSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      "Configuration: MyTurn High-Value Item Taxonomies"
    );
  const myTurnHighValueTaxa = highValueTaxaSheet
    .getRange(1, 1, highValueTaxaSheet.getMaxRows(), 1)
    .getValues()
    .reduce(function (itemTypes, row) {
      return itemTypes.concat(row[0]);
    }, [])
    .filter(function (i) {
      return Boolean(i);
    });

  return myTurnHighValueTaxa;
}

/**
 * Initiate a call dialog for a random patron who meets the user's criteria.
 *
 * @param {Object} filters - The criteria to apply to the users with overdue items
 * @param {string=} filters.itemNameToSearch - A substring that must match an item in the user's overdue cart
 * @param {boolean=} filters.onlyHigherValueItems - Whether to only include users with high-value items checked out
 */
function initiateCallDialog_(filters) {
  // Fetch some filters from the spreadsheet's configuration
  const config = getConfiguration_();
  const minimumDaysOverdue =
    Number(config["Days Overdue Before First Call"]) || 60;
  const minimumDaysSinceLastCall =
    Number(config["Minimum Days Between Calls"]) || 14;

  // Set filter defaults
  const itemNameToSearch = filters && filters.itemNameToSearch;
  const onlyHigherValueItems =
    (filters && filters.onlyHigherValueItems) || false;

  const highValueTaxa = getHighValueTaxa_();

  const usersToCall = getAllOverdueUsers_()
    .filter(function (user) {
      return (
        new Date(
          new Date(user["Latest Due Date"]).getTime() +
            minimumDaysOverdue * 24 * 60 * 60 * 1000
        ) < new Date()
      );
    })
    .filter(function (user) {
      // Has never been called or…
      return (
        !user["Most Recent Call"] ||
        // …hasn't been called in at least the past X days
        // Source: https://stackoverflow.com/questions/7687884/add-10-seconds-to-a-date
        new Date(
          new Date(user["Most Recent Call"]).getTime() +
            minimumDaysSinceLastCall * 24 * 60 * 60 * 1000
        ) < new Date()
      );
    })
    .filter(function (user) {
      return (
        !itemNameToSearch ||
        user["Overdue Item Names"]
          .toLowerCase()
          .indexOf(itemNameToSearch.toLowerCase()) > -1
      );
    })
    .filter(function (user) {
      return !user["Should Mark Items as Disabled?"];
    })
    .filter(function (user) {
      if (!onlyHigherValueItems) {
        return true;
      }

      const itemTypes = user["Overdue Item Types"].split(";");

      // Ugh, `Set`s aren't supported in this engine either
      const allItemTypesToCheck = [];
      itemTypes.forEach(function (itemType) {
        if (allItemTypesToCheck.indexOf(itemType) === -1) {
          allItemTypesToCheck.push(itemType);
        }

        var parentTaxonName = itemType;
        while (true) {
          parentTaxonName = getParentTaxonName_(parentTaxonName);
          if (parentTaxonName === null) {
            break;
          }
          if (allItemTypesToCheck.indexOf(parentTaxonName) === -1) {
            allItemTypesToCheck.push(parentTaxonName);
          }
        }
      });

      return (
        highValueTaxa.length === 0 ||
        allItemTypesToCheck.some(function (itemType) {
          return highValueTaxa.indexOf(itemType) > -1;
        })
      );
    });

  if (usersToCall.length === 0) {
    return SpreadsheetApp.getUi().alert("No calls need to be made right now");
  }

  const userToCall = getRandomItemFromArray_(usersToCall);

  const t = HtmlService.createTemplateFromFile("callForm");
  t.config = getConfiguration_();
  t.outcomeCategories = CALL_OUTCOME_CATEGORIES_;
  t.userToCall = userToCall;
  SpreadsheetApp.getUi().showModalDialog(t.evaluate(), "Overdue call to make");
}

/**
 * Initiate a dialog to ask which item name to filter for.
 */
function initiateFilteredCallDialog_() {
  const t = HtmlService.createHtmlOutputFromFile("callFilterForm");
  SpreadsheetApp.getUi().showModalDialog(t, "Filter your overdue call");
}

/**
 * Initiate a call dialog for a random patron with high-value items checked out.
 */
function initiateHigherValueCallDialog_() {
  initiateCallDialog_({ onlyHigherValueItems: true });
}
