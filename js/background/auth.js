const checkBeforeCreate = (request, tab, domain) => {
  if (mk == null) {
    // Check if locked
    const callback = () => {
      console.log("locked");
      chrome.runtime.sendMessage({
        command: "sendDialogError",
        msg: {
          success: false,
          error: "locked",
          result: null,
          data: request,
          message: "The wallet is locked!",
          display_msg:
            "The current website is trying to send a request to the Steem Keychain browser extension. Please enter your password below to unlock the wallet and continue."
        },
        tab: tab,
        domain: domain
      });
    };
    createPopup(callback);
  } else {
    chrome.storage.local.get(
      ["accounts", "no_confirm", "current_rpc"],
      function(items) {
        // Check user
        if (items.accounts == null || items.accounts == undefined) {
          createPopup(() => {
            sendErrors(tab, "no_wallet", "No wallet!", "", request);
          });
        } else {
          // Check that user and wanted keys are in the wallet
          accounts =
            items.accounts == undefined ||
            items.accounts ==
              {
                list: []
              }
              ? null
              : decryptToJson(items.accounts, mk);
          let account = null;
          if (request.type == "transfer") {
            let tr_accounts = accounts.list.filter(a =>
              a.keys.hasOwnProperty("active")
            );
            const encode =
              request.memo != undefined &&
              request.memo.length > 0 &&
              request.memo[0] == "#";
            const enforce = request.enforce || encode;
            if (encode)
              account = accounts.list.find(e => {
                return e.name == request.username;
              });
            // If a username is specified, check that its active key has been added to the wallet
            if (
              enforce &&
              request.username &&
              !tr_accounts.find(a => a.name == request.username)
            ) {
              createPopup(() => {
                console.log("error1");
                sendErrors(
                  tab,
                  "user_cancel",
                  "Request was canceled by the user.",
                  "The current website is trying to send a transfer request to the Steem Keychain browser extension for account @" +
                    request.username +
                    " using the active key, which has not been added to the wallet.",
                  request
                );
              });
            } else if (encode && !account.keys.hasOwnProperty("memo")) {
              createPopup(() => {
                console.log("error2");
                sendErrors(
                  tab,
                  "user_cancel",
                  "Request was canceled by the user.",
                  "The current website is trying to send a request to the Steem Keychain browser extension for account @" +
                    request.username +
                    " using the memo key, which has not been added to the wallet.",
                  request
                );
              });
            } else if (tr_accounts.length == 0) {
              createPopup(() => {
                console.log("error3");
                sendErrors(
                  tab,
                  "user_cancel",
                  "Request was canceled by the user.",
                  "The current website is trying to send a transfer request to the Steem Keychain browser extension for account @" +
                    request.username +
                    " using the active key, which has not been added to the wallet.",
                  request
                );
              });
            } else {
              const callback = () => {
                chrome.runtime.sendMessage({
                  command: "sendDialogConfirm",
                  data: request,
                  domain: domain,
                  accounts: tr_accounts,
                  tab: tab,
                  testnet: items.current_rpc === "TESTNET"
                });
              };
              createPopup(callback);
            }
          } else {
            if (!accounts.list.find(e => e.name == request.username)) {
              const callback = () => {
                console.log("error4");
                sendErrors(
                  tab,
                  "user_cancel",
                  "Request was canceled by the user.",
                  "The current website is trying to send a request to the Steem Keychain browser extension for account @" +
                    request.username +
                    " which has not been added to the wallet.",
                  request
                );
              };
              createPopup(callback);
            } else {
              account = accounts.list.find(function(e) {
                return e.name == request.username;
              });
              let typeWif = getRequiredWifType(request);
              let req = request;
              req.key = typeWif;

              if (req.type == "custom") req.method = typeWif;

              if (req.type == "broadcast") {
                req.typeWif = typeWif;
              }

              if (account.keys[typeWif] == undefined) {
                createPopup(() => {
                  console.log("error5");
                  sendErrors(
                    tab,
                    "user_cancel",
                    "Request was canceled by the user.",
                    "The current website is trying to send a request to the Steem Keychain browser extension for account @" +
                      request.username +
                      " using the " +
                      typeWif +
                      " key, which has not been added to the wallet.",
                    request
                  );
                });
              } else {
                key = account.keys[typeWif];
                if (
                  !hasNoConfirm(
                    items.no_confirm,
                    req,
                    domain,
                    items.current_rpc
                  )
                ) {
                  const callback = () => {
                    chrome.runtime.sendMessage({
                      command: "sendDialogConfirm",
                      data: req,
                      domain: domain,
                      tab: tab,
                      testnet: items.current_rpc === "TESTNET"
                    });
                  };
                  createPopup(callback);
                  // Send the request to confirmation window
                } else {
                  chrome.runtime.sendMessage({
                    command: "broadcastingNoConfirm"
                  });
                  performTransaction(req, tab, true);
                }
              }
            }
          }
        }
      }
    );
  }
};

const hasNoConfirm = (arr, data, domain, current_rpc) => {
  try {
    if (
      data.method == "active" ||
      arr == undefined ||
      current_rpc === "TESTNET"
    ) {
      return false;
    } else return JSON.parse(arr)[data.username][domain][data.type] == true;
  } catch (e) {
    console.log(e);
    return false;
  }
};

// Get the key needed for each type of transaction
const getRequiredWifType = request => {
  switch (request.type) {
    case "decode":
    case "signBuffer":
      return request.method.toLowerCase();
      break;
    case "post":
    case "vote":
      return "posting";
      break;
    case "custom":
      return request.method == null || request.method == undefined
        ? "posting"
        : request.method.toLowerCase();
      break;
    case "addAccountAuthority":
    case "removeAccountAuthority":
    case "broadcast":
      return request.method.toLowerCase();
    case "signedCall":
      return request.typeWif.toLowerCase();
    case "transfer":
      return "active";
      break;
    case "sendToken":
      return "active";
      break;
    case "delegation":
      return "active";
      break;
    case "witnessVote":
      return "active";
      break;
    case "powerUp":
      return "active";
      break;
    case "powerDown":
      return "active";
      break;
    case "createClaimedAccount":
      return "active";
      break;
    case "createProposal":
      return "active";
      break;
    case "removeProposal":
      return "active";
      break;
    case "updateProposalVote":
      return "active";
      break;
  }
};