/*
	This file is part of ULCDocuments Web App.
	ULCDocuments Web App is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	ULCDocuments Web App is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	You should have received a copy of the GNU General Public License
	along with ULCDocuments Web App.  If not, see <http://www.gnu.org/licenses/>.
*/

/*  ULCDOCUMENTS MAIN UI JAVASCRIPT HANDLER
*  @author Arnaud VERGNET <arnaud.vergnet@netc.fr>
*  Dev Entity: Blockchain-Elite (https://www.blockchain-elite.fr/)
*/


/* *********************************************************
 *                      CONSTANTS
 **********************************************************/

const APP_VERSION = 'beta 0.0.8';

const APP_MODE = {
    check: 0,
    sign: 1
};

const HASH_APP_MODE = [
    'check',
    'sign'
];

const HASH_PARAM_NAMES = { // Hash parameters to use when reading URL
    appMode: 'mode',
    kernelAddress: 'kernel',
};

const MIME_TYPE_ICONS = { // FontAwesome icon based on file mime type
    'image': 'far fa-file-image',
    'audio': 'far fa-file-audio',
    'video': 'far fa-file-video',
    'word': 'far fa-file-word',
    'document': 'far fa-file-word',
    'excel': 'far fa-file-excel',
    'sheet': 'far fa-file-excel',
    'powerpoint': 'far fa-file-powerpoint',
    'presentation': 'far fa-file-powerpoint',
    'pdf': 'far fa-file-pdf',
    'text': 'far fa-file-alt',
    'zip': 'far fa-file-archive',
    'fallback': 'far fa-file'
};

const TAB_TYPE = {
    file: 0,
    text: 1,
    hash: 2
};

const UI_STATE = {
    none: 'none',
    checking: 'checking',
    fetching: 'fetching',
    fetched: 'fetched',
    signing: 'signing'
};

const COLOR_CLASSES = {
    none: '',
    info: 'alert-info',
    secondary: 'alert-secondary',
    success: 'alert-success',
    warning: 'alert-warning',
    danger: 'alert-danger',
};

const ITEM_STATE_TEXT = {}; // Text based on item state to display in the UI
ITEM_STATE_TEXT[TypeElement.Unknown] = 'Awaiting user';
ITEM_STATE_TEXT[TypeElement.Loading] = 'Asking Blockchain...';
ITEM_STATE_TEXT[TypeElement.Signed] = 'Signed';
ITEM_STATE_TEXT[TypeElement.Fake] = 'Not signed';
ITEM_STATE_TEXT[TypeElement.Invalid] = 'Error';
ITEM_STATE_TEXT[TypeElement.Pending] = 'Already signed by user';
ITEM_STATE_TEXT[TypeElement.Revoked] = 'Signature revoked';
ITEM_STATE_TEXT[TypeElement.TxProcessing] = 'Processing...';
ITEM_STATE_TEXT[TypeElement.TransactionFailure] = 'Signature failed';
ITEM_STATE_TEXT[TypeElement.TransactionSuccess] = 'Signature sent';

const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB

const JQUERY_CONFIRM_THEME = 'modern';

const OSM_QUERY_LINK = 'https://www.openstreetmap.org/search?query=';

/* *********************************************************
 *                      UI OBJECT
 **********************************************************/

/**
 * Class defining UI management and backend communication functions.
 *
 * @constructor
 */
function UIManager() {

    /* *********************************************************
     *                      VARIABLES
     **********************************************************/

    let _itemList = new Map(); // A map representing the list of items to be checked (one map per type)
    // Two lists: one for the check mode, an other for sign
    _itemList.set(APP_MODE.check, new Map());
    _itemList.set(APP_MODE.sign, new Map());
    // These items inherit the ListItems class as defined in UIListItems.js
    for (let key of _itemList.keys()) {
        _itemList.get(key).set(TAB_TYPE.file, new Map());
        _itemList.get(key).set(TAB_TYPE.text, new Map());
        _itemList.get(key).set(TAB_TYPE.hash, new Map());
    }

    let _blockchainErrorMsg = new Map();
    _blockchainErrorMsg.set(APP_MODE.check, new Map());
    _blockchainErrorMsg.set(APP_MODE.sign, new Map());

    _blockchainErrorMsg.get(APP_MODE.check).set(TypeElement.Fake, ['This item is not signed', COLOR_CLASSES.danger]);
    _blockchainErrorMsg.get(APP_MODE.check).set(TypeElement.Unknown, ['Click on check to display blockchain information', COLOR_CLASSES.info]);
    _blockchainErrorMsg.get(APP_MODE.check).set(TypeElement.Invalid, ['An error occurred', COLOR_CLASSES.secondary]);
    _blockchainErrorMsg.get(APP_MODE.check).set(TypeElement.Loading, ['Asking blockchain...', COLOR_CLASSES.info]);

    _blockchainErrorMsg.get(APP_MODE.sign).set(TypeElement.Signed, ['This item is already signed', COLOR_CLASSES.danger]);
    _blockchainErrorMsg.get(APP_MODE.sign).set(TypeElement.Pending, ['You already signed this item', COLOR_CLASSES.danger]);
    _blockchainErrorMsg.get(APP_MODE.sign).set(TypeElement.Revoked, ['This item has been revoked and cannot be signed again', COLOR_CLASSES.danger]);
    _blockchainErrorMsg.get(APP_MODE.sign).set(TypeElement.Unknown, ['Click on fetch to start editing blockchain information', COLOR_CLASSES.info]);
    _blockchainErrorMsg.get(APP_MODE.sign).set(TypeElement.Invalid, ['An error occurred', COLOR_CLASSES.secondary]);
    _blockchainErrorMsg.get(APP_MODE.sign).set(TypeElement.Loading, ['Asking blockchain...', COLOR_CLASSES.info]);
    _blockchainErrorMsg.get(APP_MODE.sign).set(TypeElement.TxProcessing, ['Waiting for blockchain...', COLOR_CLASSES.info]);
    _blockchainErrorMsg.get(APP_MODE.sign).set(TypeElement.TransactionSuccess, ['Signature successfully sent!', COLOR_CLASSES.success]);
    _blockchainErrorMsg.get(APP_MODE.sign).set(TypeElement.TransactionFailure, ['Signature failed!', COLOR_CLASSES.danger]);

    const WALLET_STATE = {
        unknown: 0,
        injected: 1,
        infura: 2
    };

    let _uniqueIdCounter = 0; // unique id referencing a list item (file, text or hash)
    let _itemsProcessedCounter = 0; // The number of items in the current list (file text or hash) that have been checked
    let _currentKernelAddress = ""; // The current kernel address the user is connected to
    let _defaultModeratorAddress;
    let _currentModeratorAddress; // The current moderator address the user is connected to
    let _isModeratorConnected = false; // Is the user connected to a valid moderator ?
    let _isKernelConnected = false; // Is the user connected to a valid kernel ?
    let _isVerbose = false; // Should we display additional information in the console
    let _canUseDropZone = true; // Can the user use the dropZone ?
    let _currentTab = TAB_TYPE.file; // The current tab selected (text, file or hash)
    let _currentAppMode = APP_MODE.check; // The current app mode (check or sign)
    let _currentWalletState = WALLET_STATE.unknown; // Are we using an injected wallet (metamask) ?
    let _isAccountOwner = false; // Is the current account owner of the current kernel ?
    let _isLoadingAccounts = false; // Are we currently requesting account information ?
    let _isAccountsListAvailable = false; // Do we have an account list ready ?
    let _filesOverLimitArray = [];
    let _currentUiState = UI_STATE.none;

    /* *********************************************************
     *                      JQUERY SELECTORS
     **********************************************************/

    // Tab specific selectors
    let $tabHolders = [
        $("#dropZone"),
        $("#textBox"),
        $("#hashBox")
    ];
    let $tabButtons = [
        $("#fileTabSelector"),
        $("#textTabSelector"),
        $("#hashTabSelector")
    ];
    let $tabListItemTemplates = [
        $("#fileListItemTemplate"),
        $("#textListItemTemplate"),
        $("#hashListItemTemplate")
    ];
    let $tabListEmptyTemplate = [
        $("#fileListEmptyTemplate"),
        $("#textListEmptyTemplate"),
        $("#hashListEmptyTemplate")
    ];
    // Change app mode buttons
    let $modeButtons = [
        $(".check-mode-button"),
        $(".sign-mode-button")
    ];

    /* *********************************************************
     *                    PRIVATE FUNCTIONS
     * *********************************************************/

    /**
     * Get the app mode based on the url hash. Use check as fallback
     *
     * @return {APP_MODE} sign or check type
     */
    let detectAppMode = function () {
        let type = APP_MODE.check;
        let hashType = getUrlHashParameter(HASH_PARAM_NAMES.appMode);
        for (let key of Object.keys(APP_MODE)) {
            if (hashType === HASH_APP_MODE[APP_MODE[key]]) {
                type = APP_MODE[key];
            }
        }
        _currentAppMode = type;
        log('Detected following app mode: ' + HASH_APP_MODE[type]);
    };

    /**
     * Set the UI to fade In/Out to switch type
     *
     * @param type {APP_MODE} Sign or check type
     * @param firstRun {Boolean} Should we fadeIN/Out ?
     */
    let setUIMode = function (type, firstRun) {
        log('switching to ' + HASH_APP_MODE[type]);
        if (!firstRun) {
            $.selector_cache('#mainCardBody').fadeOut('fast', function () {
                setUIElements(type);
                $.selector_cache('#mainCardBody').fadeIn('fast');
            });
        } else {
            setUIElements(type);
        }
    };

    /**
     * Set UI elements values based on given type
     *
     * @param type {APP_MODE} The type used for element values
     */
    let setUIElements = function (type) {
        setUrlHashParameter(HASH_PARAM_NAMES.appMode, HASH_APP_MODE[type]); // update the url
        setUrlHashParameter(HASH_PARAM_NAMES.appMode, HASH_APP_MODE[type]); // update the url
        _currentAppMode = type;
        for (let key of Object.keys(APP_MODE)) {
            if (APP_MODE[key] === type)
                $modeButtons[type].addClass('active');
            else
                $modeButtons[APP_MODE[key]].removeClass('active');
        }
        if (type === APP_MODE.check) {
            $.selector_cache('#appModeCss').attr('href', 'css/check.css'); // Change the stylesheet to change the theme
            $(".btn-info").addClass('btn-primary').removeClass('btn-info'); // replace info by primary (green to blue)
            $.selector_cache('#checkButtonLogo').attr('class', 'far fa-check-square');
            $.selector_cache('#checkButtonText').html('Check');
            $.selector_cache('#signActionButtonContainer').hide();
            $.selector_cache('#accountsCard').hide();
        } else {
            $.selector_cache("#signTab").show();
            $.selector_cache('#appModeCss').attr('href', 'css/sign.css');
            $(".btn-primary").addClass('btn-info').removeClass('btn-primary');
            $.selector_cache('#checkButtonLogo').attr('class', 'fas fa-sync-alt');
            $.selector_cache('#checkButtonText').html('Fetch');
            $.selector_cache('#signActionButtonContainer').show();
            $.selector_cache('#accountsCard').show();
            if (_isKernelConnected)
                askForAccounts();
        }
        recreateAppModeItemList();
        updateMainUIState();
        UI.resetProgress();
        fileListResetSelection();
        UI.updateCheckButtonState();
    };

    let askForAccounts = function () {
        if (!_isAccountsListAvailable) {
            _isLoadingAccounts = true;
            requestAccountInfo();
        }
    };

    /**
     * Set default field values based on url hash parameters
     */
    let setDefaultFieldValues = function () {
        let kernelAddress = getUrlHashParameter(HASH_PARAM_NAMES.kernelAddress);
        if (kernelAddress !== undefined) {
            _currentKernelAddress = kernelAddress;
            $.selector_cache('#kernelAddressInput').val(_currentKernelAddress);
        }
    };

    /**
     * Display the UI and connect to the kernel specified in the url
     */
    let tryReadyUI = function () {
        if (_isModeratorConnected && _currentWalletState !== WALLET_STATE.unknown
            && $.selector_cache('#loadingScreen').css('display') !== 'none') {
            // Display the UI
            $.selector_cache('#loadingScreen').fadeOut('fast', function () {
                $.selector_cache('#baseContainer').fadeIn('fast');
            });
            // Connect to kernel
            if (_currentKernelAddress !== '')
                UI.connectToKernel();
        }
    };

    /**
     * Create the lists in every tab for the current app mode
     */
    let recreateAppModeItemList = function () {
        for (let i of Object.keys(TAB_TYPE)) {
            let tab = TAB_TYPE[i];
            let list = getList(_currentAppMode, tab);
            if (list.size)
                $tabHolders[tab].html(""); // Items available, clear the tab
            else
                resetTabZone(tab); // Reset the zones
            for (let item of list.values()) {
                item.createEntry(false);
            }
            updateDisplayIds(tab); // Update the ids for the list
        }
    };

    this.connectToKernel = function () {
        setKernelConnectionLoading(true);
        setUrlHashParameter(HASH_PARAM_NAMES.kernelAddress, _currentKernelAddress);
        updateKernelAddress(_currentKernelAddress); // Call to ULCDocMaster
    };

    /**
     * Register global page events and associate listeners
     */
    let registerEvents = function () {
        for (let key of Object.keys(APP_MODE)) {
            $modeButtons[APP_MODE[key]].on('click', function () {
                if (!$modeButtons[APP_MODE[key]].hasClass('active')) // Do not change if we are already in this mode
                    setUIMode(APP_MODE[key], false);
            });
        }
        $.selector_cache('#clearItemListButton').on('click', function () { // Remove all items from the list in the current tab
            let itemsList = getCurrentList().values();
            for (let item of itemsList) {
                item.removeEntryAnimation();
            }
        });
        $.selector_cache('#checkButton').on('click', function () {
            checkStart();
        });
        $.selector_cache('#signButton').on('click', function () {
            startSign();
        });
        $.selector_cache('#cancelButton').on('click', function () {
            UI.setUIButtonState(UI_STATE.none);
            UI.resetProgress();
        });

        $.selector_cache('#kernelAddressInputConnect').on('click', function () {
            _currentKernelAddress = $.selector_cache('#kernelAddressInput').val();
            UI.connectToKernel();
        });

        $tabHolders[TAB_TYPE.file] // DropZone management
            .on("dragover", function (event) {
                event.stopPropagation();
                event.preventDefault();
                if (_canUseDropZone)
                    $tabHolders[TAB_TYPE.file].addClass('drop-hover shadow');
                return true;
            })
            .on("drop", function (event) {
                event.stopPropagation();
                event.preventDefault();
                $tabHolders[TAB_TYPE.file].removeClass('drop-hover shadow');
                if (_canUseDropZone) {
                    if (event.originalEvent.dataTransfer && event.originalEvent.dataTransfer.files.length !== 0) {
                        let files = event.originalEvent.dataTransfer.files;
                        importFiles(files);

                    } else {
                        log('Browser does not support drag and drop', TypeInfo.Warning);
                        alert('Browser does not support drag and drop');
                    }
                } else
                    log('DropZone disabled', TypeInfo.Warning);
            })
            .on("dragexit", function () {
                $tabHolders[TAB_TYPE.file].removeClass('drop-hover shadow');
            });
        $.selector_cache('#importButtonHolder').on('click', function () {
            $.selector_cache('#importButton').trigger('click');
        });
        $.selector_cache('#importButton').on('change', function (event) {
            importFiles(event.target.files);
        });
        $.selector_cache('#addItemButton').on('click', function () {
            createItemEntry();
        });
        $.selector_cache("body")
            .on('click', function (e) {
                // Remove button clicked
                if (e.target.className.search('remove-list-item-button') !== -1) {
                    removeItemClick(e.target)
                } else {
                    let $card = getCardFromTarget($(e.target));
                    if ($card !== undefined) {
                        let index = getFileIndexFromId($card.attr('id'));
                        fileListResetSelection();
                        listItemClick(index);
                    }
                }
            })
            .on('mouseenter', '.item-card', function (e) {
                let $card = getCardFromTarget($(e.target));
                if ($card !== undefined)
                    $card.addClass('file-hover')
            })
            .on('mouseleave', '.item-card', function (e) {
                let $card = getCardFromTarget($(e.target));
                if ($card !== undefined)
                    $card.removeClass('file-hover')
            });
        // Manage collapse icon
        $.selector_cache(".customCollapse").on('show.bs.collapse', function (e) {
            let parent = $($(e.target).attr('data-parent'));
            if (parent !== undefined) {
                let icon = parent.find('.collapseIcon');
                icon.fadeOut('fast', function () {
                    icon.fadeIn('fast');
                    icon.attr('class', 'collapseIcon fas fa-angle-up');
                });
            }
        }).on('hide.bs.collapse', function (e) {
            let parent = $($(e.target).attr('data-parent'));
            if (parent !== undefined) {
                let icon = parent.find('.collapseIcon');
                icon.fadeOut('fast', function () {
                    icon.fadeIn('fast');
                    icon.attr('class', 'collapseIcon fas fa-angle-down');
                });
            }
        });
        // Manage tab click
        for (let i of Object.keys(TAB_TYPE)) {
            $tabButtons[TAB_TYPE[i]].on('click', function () {
                tabClick(TAB_TYPE[i]);
            });
        }
        $.selector_cache('#kernelConnectionEditButton').on('click', function () {
            showKernelInput();
        });
        $.selector_cache('#advancedOptionsButton').on('click', function () {
            $.confirm({
                title: 'Are you sure?',
                content: 'These options are for advanced users only.<br>Continue at your own risk.',
                theme: JQUERY_CONFIRM_THEME,
                type: 'orange',
                icon: 'fas fa-exclamation-triangle',
                escapeKey: 'cancel',
                columnClass: 'medium',
                typeAnimated: true,
                buttons: {
                    confirm: {
                        keys: ['enter'],
                        btnClass: 'btn-orange',
                        action: function () {
                            showModeratorInput();
                        }
                    },
                    cancel: function () {
                        // Close
                    },
                }
            });
        });
    };

    let showModeratorInput = function () {
        let checkAttr = 'checked';
        if (!_isVerbose)
            checkAttr = '';

        let message =
            '<form>' +
            '   <div class="form-group">' +
            '       <label>Current moderator address:</label>' +
            '       <label>' + _currentModeratorAddress + '</label>' +
            '   </div>' +
            '   <div class="form-group">' +
            '       <label>New moderator address:</label>' +
            '       <input  type="text" class="form-control"' +
            '       id="moderatorInput"' +
            '       placeholder="Enter Address Here"/>' +
            '   </div>' +
            '</form>' +
            '<div class="custom-control form-control-lg custom-checkbox">' +
            '    <input type="checkbox" class="custom-control-input" id="verboseButton" ' + checkAttr + '>' +
            '    <label class="custom-control-label" for="verboseButton">Verbose</label>' +
            '</div>';

        $.confirm({
            title: 'Advanced Options',
            content: message,
            type: 'orange',
            theme: JQUERY_CONFIRM_THEME,
            columnClass: 'medium',
            icon: 'fas fa-cog',
            escapeKey: 'cancel',
            typeAnimated: true,
            onContentReady: function () {
                // when content is fetched & rendered in DOM
                $("#moderatorInput").focus(); // Focus the input for faster copy/paste
            },
            buttons: {
                default: {
                    text: 'Use Default Settings',
                    btnClass: 'btn-green',
                    action: function () {
                        UI.setVerbose(false);
                        _currentModeratorAddress = _defaultModeratorAddress;
                        connectToModerator();
                    }
                },
                formSubmit: {
                    text: 'Confirm',
                    btnClass: 'btn-blue',
                    keys: ['enter'],
                    action: function () {
                        let address = this.$content.find('#moderatorInput').val();
                        UI.setVerbose(this.$content.find('#verboseButton').is(':checked'));
                        if (address !== '')
                            showConfirmModerator(address);
                    }
                },
                cancel: function () {
                    // Close
                },
            },
        });
    };

    let showConfirmModerator = function (address) {
        $.confirm({
            title: 'Security consideration',
            content: "Do you really want to change authority?<br/>" +
                "This may lead to security issues. Continue only if you trust the new authority.",
            type: 'orange',
            theme: JQUERY_CONFIRM_THEME,
            columnClass: 'medium',
            icon: 'fas fa-exclamation-triangle',
            escapeKey: 'cancel',
            typeAnimated: true,
            buttons: {
                confirm: {
                    keys: ['enter'],
                    btnClass: 'btn-orange',
                    action: function () {
                        _currentModeratorAddress = address;
                        connectToModerator();
                    }
                },
                cancel: function () {
                    // Close
                }
            }
        });
    };

    let connectToModerator = function () {
        _isModeratorConnected = false;
        setModeratorConnectionLoading(true);
        updateModeratorAddress(_currentModeratorAddress); // Call to ULCDocMaster
    };

    /**
     * Show a dialog to enter a new kernel address
     */
    let showKernelInput = function () {
        let checkedAttr = _currentAppMode === APP_MODE.sign ? 'checked' : '';
        $.confirm({
            title: 'Change kernel address',
            content: '' +
                '<form>' +
                '<div class="form-group">' +
                '<label>Current kernel address:</label>' +
                '<label>' + _currentKernelAddress + '</label>' +
                '</div>' +
                '<div class="form-group">' +
                '<label>New kernel address:</label>' +
                '<input  type="text" class="form-control"' +
                ' id="kernelInput"' +
                ' placeholder="Enter Address Here"/>' +
                '</div>' +
                '</form>' +
                '<div class="custom-control form-control-lg custom-checkbox">' +
                '    <input type="checkbox" class="custom-control-input" id="enableSignButton"' + checkedAttr + '>' +
                '    <label class="custom-control-label" for="enableSignButton">Enable signing for this kernel</label>' +
                '</div>',
            type: 'blue',
            theme: JQUERY_CONFIRM_THEME,
            columnClass: 'medium',
            icon: 'fas fa-edit',
            escapeKey: 'cancel',
            typeAnimated: true,
            onContentReady: function () {
                // when content is fetched & rendered in DOM
                $("#kernelInput").focus(); // Focus the input for faster copy/paste
            },
            buttons: {
                formSubmit: {
                    text: 'Connect',
                    btnClass: 'btn-blue',
                    keys: ['enter'],
                    action: function () {
                        let address = this.$content.find('#kernelInput').val();
                        if (address === '') {
                            $.alert({
                                    title: 'error',
                                    content: 'Please enter a value',
                                    type: 'red',
                                    theme: JQUERY_CONFIRM_THEME,
                                    icon: 'fas fa-exclamation',
                                    escapeKey: 'ok',
                                    typeAnimated: true,
                                }
                            );
                            return false;
                        }
                        if (this.$content.find('#enableSignButton').is(':checked')) {
                            $.selector_cache("#signTab").show();
                            setUIMode(APP_MODE.sign, false);
                        }
                        _currentKernelAddress = address;
                        UI.connectToKernel();
                    }
                },
                cancel: function () {
                    //close
                },
            },
        });
    };

    /**
     * Show the content of the tab based on its type
     *
     * @param type {TAB_TYPE} The type of the tab clicked
     */
    let tabClick = function (type) {
        for (let i of Object.keys(TAB_TYPE)) {
            if (TAB_TYPE[i] !== type) {
                $tabButtons[TAB_TYPE[i]].removeClass('active');
                $tabHolders[TAB_TYPE[i]].hide();
            } else {
                $tabButtons[TAB_TYPE[i]].addClass('active');
                $tabHolders[TAB_TYPE[i]].show();
                _currentTab = TAB_TYPE[i];
            }
        }

        if (type !== TAB_TYPE.file) {
            $.selector_cache('#importButtonHolder').hide();
            $.selector_cache('#addItemButton').show();
        } else {
            $.selector_cache('#addItemButton').hide();
            $.selector_cache('#importButtonHolder').show();
        }
        UI.resetProgress();
        fileListResetSelection();
        UI.updateCheckButtonState();
    };

    /**
     * Callback when clicking delete on a file list item.
     * Remove the file corresponding to the delete button clicked.
     *
     * @param elem The DOM element which was clicked on
     */
    let removeItemClick = function (elem) {
        getCurrentListItem(getFileIndexFromId(elem.id)).removeEntryAnimation();
    };

    /**
     * Start the action (check or fetch) based on the selected tab
     *
     */
    let checkStart = function () {
        UI.resetProgress(); // reset progress
        if (_currentTab !== TAB_TYPE.file)
            cleanList(); // remove invalid test/hash entries before checking
        if (!isCurrentItemListEmpty()) {
            for (let item of getCurrentList().values()) {
                item.setType(TypeElement.Loading);
            }
            UI.setUIButtonState(UI_STATE.checking);
            log('Checking started...');
            _itemsProcessedCounter = 0;
            checkNextItem();
        } else {
            log('No files to check', TypeInfo.Warning);
            sendNotification(TypeInfo.Critical, 'Aborted', 'Nothing to do...');
        }
    };

    /**
     * Removes empty text/hash items from the list
     */
    let cleanList = function () {
        for (let item of getCurrentList().values()) {
            switch (_currentTab) {
                case TAB_TYPE.text:
                    if (item.getText().length === 0)
                        UI.removeItemFromList(item.getIndex(), item.isSelected());
                    break;
                case TAB_TYPE.hash:
                    if (item.getHash().length === 0)
                        UI.removeItemFromList(item.getIndex(), item.isSelected());
            }
        }
    };

    /**
     * Lock/Unlock connection related buttons
     *
     * @param state {Boolean} To enable or disable the buttons
     */
    let setConnectionButtonLockedState = function (state) {
        $.selector_cache('#advancedOptionsButton').attr('disabled', state);
        $.selector_cache('#kernelConnectionEditButton').attr('disabled', state);
    };

    /**
     * Lock/Unlock UI components interaction while checking/signing
     *
     * @param state {UI_STATE} How should we lock the UI ?
     */
    this.setUIButtonState = function (state) {
        log('Setting ui working mode to: ' + UI_STATE[state]);
        // Common locked elements
        let isWorking = state !== UI_STATE.none;
        setUITabsState(isWorking);
        // Lock connection change
        setConnectionButtonLockedState(isWorking);
        setActionButtonIcon(state);

        // Lock item management
        let canManageItems = state === UI_STATE.none || state === UI_STATE.fetched;
        _canUseDropZone = canManageItems;
        $.selector_cache('#importButton').attr('disabled', !canManageItems);
        $.selector_cache('#importButtonHolder').attr('disabled', !canManageItems);
        $.selector_cache('#clearItemListButton').attr('disabled', !canManageItems);
        $.selector_cache('#addItemButton').attr('disabled', !canManageItems);
        $.selector_cache('#addItemButton').attr('disabled', !canManageItems);
        $.selector_cache('#itemTextInput').attr('disabled', !canManageItems);
        $.selector_cache('#itemHashInput').attr('disabled', !canManageItems);
        for (let item of getCurrentList().values()) {
            item.setItemLocked(!canManageItems);
        }
        if (state !== UI_STATE.none)
            $.selector_cache('#checkButton').attr('disabled', true);
        else
            UI.updateCheckButtonState();
        if (state !== UI_STATE.fetched)
            $.selector_cache('.sign-next-step-logo').css('color', '#E9ECEF');
        else
            $.selector_cache('.sign-next-step-logo').css('color', '#17A2B8');

        $.selector_cache('#signButton').attr('disabled', state !== UI_STATE.fetched);
        $.selector_cache('#cancelButton').attr('disabled', state !== UI_STATE.fetched);
        // Reset elements type if we cancel fetching
        if (state === UI_STATE.none && (_currentUiState === UI_STATE.fetching || _currentUiState === UI_STATE.fetched))
            resetElementsFromList(getCurrentList());

        _currentUiState = state;
    };

    /**
     * Set the action Button icon based on the given UI state
     * @param state {UI_STATE} The UI state used to decide the icon
     */
    let setActionButtonIcon = function (state) {
        switch (state) {
            case UI_STATE.checking:
                $.selector_cache('#checkButtonLogo').attr('class', 'fas fa-circle-notch fa-spin fa-fw');
                break;
            case UI_STATE.fetching:
                $.selector_cache('#checkButtonLogo').attr('class', 'fas fa-circle-notch fa-spin fa-fw');
                break;
            case UI_STATE.fetched:
                $.selector_cache('#checkButtonLogo').attr('class', 'fas fa-check');
                break;
            case UI_STATE.signing:
                $.selector_cache('#signButtonLogo').attr('class', 'fas fa-circle-notch fa-spin fa-fw');
                break;
            case UI_STATE.none:
                if (_currentAppMode === APP_MODE.sign) {
                    $.selector_cache('#checkButtonLogo').attr('class', 'fas fa-sync-alt');
                    $.selector_cache('#signButtonLogo').attr('class', 'far fa-edit');
                } else {
                    $.selector_cache('#checkButtonLogo').attr('class', 'far fa-check-square');
                }
                break;
        }
    };

    let setUITabsState = function (disabled) {
        for (let key of Object.keys(APP_MODE)) {
            $modeButtons[APP_MODE[key]].attr('disabled', disabled);
        }
        for (let i in TAB_TYPE) {
            $tabButtons[TAB_TYPE[i]].attr('disabled', disabled)
        }
    };

    /**
     * Set the file list item selected, associated to the index.
     *
     * @param index {Number} The file unique index
     */
    let listItemClick = function (index) {
        for (let item of getCurrentList().values()) { // unselect previous items
            if (item.getIndex() !== index) {
                item.setSelected(false);
            }
        }
        getCurrentListItem(index).setSelected(true);
    };

    /**
     * Create a file list entry for all files in the given list.
     *
     * @param fileList {FileList} The list of files to add
     */
    let importFiles = function (fileList) {
        _filesOverLimitArray = [];
        for (let i = 0; i < fileList.length; i++) {
            createFileListEntry(fileList[i]);
        }
        if (_filesOverLimitArray.length > 0)
            displayFilesOverLimitError();
    };

    /**
     * Display an error message showing which files were too large to be imported.
     */
    let displayFilesOverLimitError = function () {
        let message = 'The following files were larger than <strong>150MB</strong> and could not be imported:' +
            '<ul></ul>';
        for (let i = 0; i < _filesOverLimitArray.length; i++) {
            message += '<li>' + _filesOverLimitArray[i] + '</li>';
        }
        message += '<br>Please make sure your files are smaller than <strong>150MB</strong> before importing them.';
        $.alert({
            title: 'Some files could not be imported',
            content: message,
            type: 'red',
            theme: JQUERY_CONFIRM_THEME,
            escapeKey: 'ok',
            icon: 'fas fa-exclamation-circle',
            columnClass: 'medium',
            typeAnimated: true,
            buttons: {
                ok: {
                    keys: ['enter']
                }
            }
        });
    };


    /**
     * Check if the given file is valid.
     * For a file to be valid, its size must be smaller than 150MB, and be a valid File Object reference.
     *
     * @param file {File} The file object to check
     * @return {Boolean} Whether the file is valid or not.
     */
    let isFileValid = function (file) {
        let valid = true;
        if (file !== undefined) {
            if (file.size > MAX_FILE_SIZE) {
                _filesOverLimitArray.push(file.name);
                log("file is larger than 150MB: " + file.name, TypeInfo.Critical);
                valid = false;
            }
        } else {
            $.alert({
                title: 'File could not be imported',
                content: 'An unknown error prevented a file from being imported.<br>' +
                    'Please make sure your files are not corrupted.',
                type: 'red',
                theme: 'modern',
                escapeKey: 'ok',
                icon: 'fas fa-exclamation-circle',
                columnClass: 'medium',
                typeAnimated: true,
                buttons: {
                    ok: {
                        keys: ['enter']
                    }
                }
            });
            log("file could not be imported. Unknown error.", TypeInfo.Critical);
            valid = false;
        }
        return valid;
    };

    /**
     * If the given file is valid, create a file item list entry.
     *
     * @param file {File} The DOM element which was clicked on
     */
    let createFileListEntry = function (file) {
        if (isFileValid(file)) {
            // Check if file or directory
            let reader = new FileReader();
            reader.onload = function () { // read the file to check if valid
                if (getList(_currentAppMode, TAB_TYPE.file).size === 0) {
                    $tabHolders[TAB_TYPE.file].html(""); // init drop zone
                }
                let item = new FileListItem(_uniqueIdCounter, file, _currentAppMode);
                item.createEntry(true);
                getList(_currentAppMode, TAB_TYPE.file).set(_uniqueIdCounter, item);
                UI.updateCheckButtonState();
                UI.setUIButtonState(UI_STATE.none);
                UI.resetProgress();
                _uniqueIdCounter += 1;
                listItemClick(item.getIndex());
            };
            reader.onerror = function () { // file is invalid
                sendNotification(TypeInfo.Critical, "Error", "Could not read file '" + file.name + "'");
                log("Could not read file '" + file.name + "'", TypeInfo.Critical);
            };
            reader.readAsDataURL(file);
        }
    };

    /**
     * Create a text or hash list entry based on the current tab
     */
    let createItemEntry = function () {
        let item;
        if (isCurrentItemListEmpty()) {
            $tabHolders[_currentTab].html(""); // init zone
        }
        if (_currentTab === TAB_TYPE.text)
            item = new TextListItem(_uniqueIdCounter, _currentAppMode);
        else
            item = new HashListItem(_uniqueIdCounter, _currentAppMode);
        item.createEntry(true);
        getCurrentList().set(_uniqueIdCounter, item);
        _uniqueIdCounter += 1;
        UI.updateCheckButtonState();
        UI.setUIButtonState(UI_STATE.none);
        UI.resetProgress();
        updateDisplayIds(_currentTab);

        listItemClick(item.getIndex());
    };

    /**
     * Update the numbers on text and hash items based on their order in the list
     *
     * @param type {TAB_TYPE} The tab (text or hash) to update
     */
    let updateDisplayIds = function (type) {
        if (type !== TAB_TYPE.file) { // Do not fix the ids for the file tab
            let i = 1;
            for (let item of getList(_currentAppMode, type).values()) {
                item.setTitle(i);
                i++;
            }
        }
    };

    /**
     * Reset the zone inside the given tab.
     *
     * @param type {TAB_TYPE} The tab to reset
     */
    let resetTabZone = function (type) {
        $tabHolders[type].html("");
        $tabListEmptyTemplate[type].contents().clone()
            .appendTo($tabHolders[type])
            .on('click', function () {
                if (_currentTab === TAB_TYPE.file)
                    $.selector_cache('#importButton').trigger('click');
                else
                    createItemEntry();
            });
    };

    /**
     * Send the next file in the list to the backend to be checked and update the progress bar.
     */
    let checkNextItem = function () {
        if (_itemsProcessedCounter < getCurrentList().size) {
            log('Checking next item', TypeInfo.Info);
            updateProgress(_itemsProcessedCounter, false);
            let currentItem = getCurrentListItemByIndex(_itemsProcessedCounter);
            if (_currentAppMode === APP_MODE.check) {
                $.selector_cache('#actionInProgress').html('Checking...');
                switch (_currentTab) {
                    case TAB_TYPE.file:
                        checkFile(currentItem.getFile(), currentItem.getIndex());
                        break;
                    case TAB_TYPE.text:
                        checkText(currentItem.getText(), currentItem.getIndex());
                        break;
                    case TAB_TYPE.hash:
                        checkHash(currentItem.getHash(), currentItem.getIndex());
                        break;
                }
            } else {
                $.selector_cache('#actionInProgress').html('Fetching information...');
                // Do not calculate the hash if we already have it
                if (currentItem.getHash() !== '')
                    fetchHash(currentItem.getHash(), currentItem.getIndex());
                else {
                    switch (_currentTab) {
                        case TAB_TYPE.file:
                            fetchFile(currentItem.getFile(), currentItem.getIndex());
                            break;
                        case TAB_TYPE.text:
                            fetchText(currentItem.getText(), currentItem.getIndex());
                            break;
                        case TAB_TYPE.hash:
                            fetchHash(currentItem.getHash(), currentItem.getIndex());
                            break;
                    }
                }

            }
        } else if (_currentAppMode === APP_MODE.check) // If we finished checking
            endCheck();
        else  // if we finished fetching
            trySign();
    };

    /**
     * Re-enable the UI and display notifications
     */
    let endCheck = function () {
        log('Finished checking all the items', TypeInfo.Info);
        updateProgress(0, true);
        UI.setUIButtonState(UI_STATE.none);
    };

    /**
     * Check if we can start the signing procedure
     */
    let trySign = function () {
        updateProgress(0, true);
        let invalidElements = getInvalidElements();
        if (invalidElements.length)
            displayInvalidElementsError(invalidElements);
        else
            UI.setUIButtonState(UI_STATE.fetched);
    };

    /**
     * Display an error message showing the invalid elements that cannot be signed.
     *
     * @param invalidElements {Array} An array containing the invalid elements
     */
    let displayInvalidElementsError = function (invalidElements) {
        let message = 'Finished fetching information with some errors.<br>The following items cannot be signed:<ul></ul>';
        for (let i = 0; i < invalidElements.length; i++) {
            if (_currentTab === TAB_TYPE.file) // Display the file name if we are in the file tab, or the item title
                message += '<li>' + getCurrentListItem(invalidElements[i]).getFile().name + '</li>';
            else
                message += '<li>' + getCurrentListItem(invalidElements[i]).getTitle() + '</li>';
        }
        message += '<br>Click on <strong>CONTINUE</strong> to remove the items above, you will then be able to select ' +
            'items in the list to fill in  signing information.' +
            '<br>Click on <strong>CANCEL</strong> to abort signing and see why these are invalid.';
        $.confirm({
            title: 'Fetch Finished',
            content: message,
            type: 'blue',
            theme: JQUERY_CONFIRM_THEME,
            escapeKey: 'cancel',
            icon: 'fas fa-exclamation',
            columnClass: 'medium',
            typeAnimated: true,
            buttons: {
                continue: {
                    keys: ['enter'],
                    btnClass: 'btn-blue',
                    action: function () {
                        removeInvalidElements(invalidElements);
                        if (getCurrentList().size) {
                            sendNotification(TypeInfo.Good, 'Ready to sign', 'Removed invalid elements. ' +
                                'You can now start signing.');
                            UI.setUIButtonState(UI_STATE.fetched);
                        } else {
                            sendNotification(TypeInfo.Critical, 'Error', 'No valid document to sign');
                            UI.setUIButtonState(UI_STATE.none);
                        }
                    }
                },
                cancel: function () {
                    UI.setUIButtonState(UI_STATE.none);
                },
            }
        });
    };

    /**
     * Get elements that cannot be signed in the list
     *
     * @return {Array} The array of indexes of invalid items
     */
    let getInvalidElements = function () {
        let elements = [];
        for (let item of getCurrentList().values()) {
            if (item.getType() !== TypeElement.Fake) {
                elements.push(item.getIndex());
            }
        }
        return elements;
    };

    /**
     * Reset element state and information from the given list
     *
     * @param list {Map} the map containing the items to reset
     */
    let resetElementsFromList = function (list) {
        for (let item of list.values()) {
            item.setType(TypeElement.Unknown);
            item.setInformation(new Map());
            item.setExtraData(new Map());
        }
    };

    /**
     * Reset elements from every list
     */
    let resetAllElements = function () {
        for (let mode of Object.keys(APP_MODE)) {
            for (let tab of Object.keys(TAB_TYPE)) {
                resetElementsFromList(getList(APP_MODE[mode], TAB_TYPE[tab]));
            }
        }
        UI.resetProgress();
    };

    /**
     * Remove invalid elements from the list before signing
     *
     * @param elements {Array} The array of indexes of invalid items
     */
    let removeInvalidElements = function (elements) {
        for (let i of elements) {
            UI.removeItemFromList(i, true);
        }
    };

    /**
     * Ask the user to start the signing procedure
     */
    let startSign = function () {
        $.confirm({
            title: 'Are you sure?',
            content: 'Signing is permanent, make sure you are signing the right documents.<br>Do you want to continue?',
            theme: JQUERY_CONFIRM_THEME,
            type: 'blue',
            icon: 'fas fa-exclamation',
            escapeKey: 'cancel',
            columnClass: 'medium',
            typeAnimated: true,
            buttons: {
                confirm: {
                    keys: ['enter'],
                    btnClass: 'btn-blue',
                    action: function () {
                        UI.setUIButtonState(UI_STATE.signing);

                        let allRequest = [[],[],[]];

                        for(let _itemsProcessedCounter = 0 ; _itemsProcessedCounter < getCurrentList().size ; _itemsProcessedCounter++){
                            $.selector_cache('#actionInProgress').html('Signing...');
                            updateProgress(_itemsProcessedCounter, false);
                            let currentItem = getCurrentListItemByIndex(_itemsProcessedCounter);
                            allRequest[0].push(currentItem.getHash());
                            allRequest[1].push(getItemInfoToSign(currentItem));
                            allRequest[2].push(currentItem.getIndex());
                        }

                        signOptimisedDocuments(allRequest[0],allRequest[1],allRequest[2]);


                    }
                },
                cancel: function () {
                    UI.setUIButtonState(UI_STATE.fetched);
                },
            }
        });
    };

    /**
     * Send the next hash to the backend to sign it
     */
    let signNextItem = function () {
        if (_itemsProcessedCounter < getCurrentList().size) {
            log('Signing next item', TypeInfo.Info);
            $.selector_cache('#actionInProgress').html('Signing...');
            updateProgress(_itemsProcessedCounter, false);
            let currentItem = getCurrentListItemByIndex(_itemsProcessedCounter);
            _itemsProcessedCounter += 1;
            signDocument(currentItem.getHash(), getItemInfoToSign(currentItem), currentItem.getIndex());
        } else
            endSign();
    };

    /**
     * Get a map containing information to sign, or undefined if no info has been entered
     *
     * @param item {ListItem} The list item to sign
     * @return {Map<any, any>} The map of information to sign or undefined
     */
    let getItemInfoToSign = function (item) {
        let infoMap = new Map(item.getInformation());
        if (item.getNumSign() === 0) {// We are the first to sign, we can enter values
            item.clearCustomExtraData();
            if (item.getCustomExtraData().length) {// We have valid extra data
                item.setExtraData(customExtraToMap(item.getCustomExtraData()));
                infoMap.set(elementReservedKeys.extraData, item.getExtraData());
            }
            if (infoMap.size === 0) //If no data, set map to undefined
                infoMap = undefined;
        } else // We are not the first one to sign, we cannot enter new values
            infoMap = undefined;
        return infoMap;
    };

    /**
     * Re-enable the UI and display notifications
     */
    let endSign = function () {
        log('Finished sending signing transactions documents', TypeInfo.Info);
        sendNotification(TypeInfo.Good, 'Signing Finished', 'Finished sending signing transactions.' +
            ' Awaiting blockchain response...');
        updateProgress(0, true);
        UI.setUIButtonState(UI_STATE.none);
    };

    /**
     * Update the progress bar based on the number of files already checked.
     *
     * @param progress {Number} the number number of files that have already been checked.
     * @param isFinished {Boolean} Whether the checking process is finished
     */
    let updateProgress = function (progress, isFinished = false) {
        if (isFinished) { // Finished
            $.selector_cache('#fileInProgress').html('...');
            $.selector_cache('#actionInProgress').html('Finished');
            $.selector_cache('#actionProgressBar').css("width", "100%");
            $.selector_cache('#actionProgressBar').attr("aria-valuenow", "100");
            $.selector_cache('#actionProgressBar').html('100%');
            $.selector_cache('#actionProgressBar').removeClass('progress-bar-animated');
        } else if (progress === -1) { // Not started
            $.selector_cache('#fileInProgress').html('...');
            $.selector_cache('#actionInProgress').html('Not started');
            $.selector_cache('#actionProgressBar').css("width", "0");
            $.selector_cache('#actionProgressBar').attr("aria-valuenow", "0");
            $.selector_cache('#actionProgressBar').html('');
        } else { // In progress
            let currentItem = getCurrentListItemByIndex(progress);
            switch (_currentTab) {
                case TAB_TYPE.file:
                    $.selector_cache('#fileInProgress').html(currentItem.getFile().name);
                    break;
                case TAB_TYPE.text:
                    $.selector_cache('#fileInProgress').html(currentItem.getTitle());
                    break;
                case TAB_TYPE.hash:
                    $.selector_cache('#fileInProgress').html(currentItem.getTitle());
                    break;
            }
            let percent = 100 * progress / getCurrentList().size;
            $.selector_cache('#actionProgressBar').css("width", percent + "%");
            $.selector_cache('#actionProgressBar').attr("aria-valuenow", percent);
            $.selector_cache('#actionProgressBar').html(Math.round(percent) + '%');
            $.selector_cache('#actionProgressBar').addClass('progress-bar-animated');
        }
    };

    this.resetProgress = function () {
        updateProgress(-1, false);
    };

    /**
     * Enable or disable the kernel connecting UI.
     *
     * @param state {Boolean} Whether to enable the UI
     */
    let setKernelConnectionLoading = function (state) {
        log('Setting kernel connecting UI to: ' + state, TypeInfo.Info);
        setConnectionButtonLockedState(state);
        UI.updateCheckButtonState();
        if (state) { // Instantly display connecting
            _isKernelConnected = false;
            updateMainUIState();
            $.selector_cache('#kernelConnectedAddress').html('Connection in progress...');
            setDOMColor($.selector_cache('#kernelInfoHeader'), COLOR_CLASSES.secondary);
            $.selector_cache('#kernelConnectionInfoIcon').attr('class', 'fas fa-circle-notch fa-spin fa-fw');
            $.selector_cache('#kernelConnectionLoadingIcon').attr('class', 'fas fa-circle-notch fa-spin fa-fw');
            setKernelInfo(undefined, TypeInfo.Info);
        } else {
            $.selector_cache('#kernelConnectionLoadingIcon').attr('class', 'fas fa-arrow-right');
        }
    };

    /**
     * Enable or disable the moderator connecting UI.
     *
     * @param state {Boolean} Whether to enable the UI
     */
    let setModeratorConnectionLoading = function (state) {
        log('Setting moderator connecting UI to: ' + state, TypeInfo.Info);
        // Disable the input while we connect
        setConnectionButtonLockedState(state);
        UI.updateCheckButtonState();
        if (state) { // Instantly display connecting
            _isKernelConnected = false;
            _isModeratorConnected = false;
            updateMainUIState();
            $.selector_cache('#moderatorConnectedAddress').html('Connection in progress...');
            setDOMColor($.selector_cache('#moderatorInfoHeader'), COLOR_CLASSES.secondary);
        }
        if (state) {
            $.selector_cache('#moderatorConnectionInfoIcon').attr('class', 'fas fa-circle-notch fa-spin fa-fw');
            $.selector_cache('#moderatorConnectionLoadingIcon').attr('class', 'fas fa-circle-notch fa-spin fa-fw');
        } else {
            $.selector_cache('#moderatorConnectionLoadingIcon').attr('class', 'fas fa-arrow-right');
        }
    };

    /**
     * Fill the kernel info table with information from result.
     * Display an error if result is undefined.
     *
     * @param result {Map} Result dictionary or undefined to use the error text.
     * @param errorType {TypeInfo} Type of the error.
     */
    let setKernelInfo = function (result, errorType) {
        $.selector_cache("#kernelInfoBody").fadeOut('fast', function () {
            $.selector_cache('#kernelInputForm').hide();
            $.selector_cache('#kernelLoadingIcon').hide();
            if (result !== undefined) {
                log('Setting kernel info', TypeInfo.Info);
                $.selector_cache('#kernelInfoZone').show();
                $.selector_cache('#kernelInfoEmptyZone').hide();
                $.selector_cache('#kernelConnectionEditButton').show();
                setKernelReservedFields(result);
                setKernelConnectedAddress(result);
                setKernelExtraData(result);
            } else {
                $.selector_cache('#kernelInfoZone').hide();
                $.selector_cache('#kernelInfoEmptyZone').show();
                $.selector_cache('#kernelConnectionEditButton').hide();

                let errorText = "Not connected";
                switch (errorType) {
                    case TypeInfo.Warning:
                        errorText = 'Connection could not be verified by moderator';
                        $.selector_cache('#kernelConnectionEditButton').show();
                        break;
                    case TypeInfo.Critical:
                        errorText = 'Connection could not be established, please enter a valid address below:';
                        $.selector_cache('#kernelInputForm').show();
                        break;
                    case TypeInfo.Info:
                        errorText = 'Loading...';
                        $.selector_cache('#kernelLoadingIcon').show();
                        break;
                    default:
                        errorText = 'Not connected, please enter a kernel address below';
                        $.selector_cache('#kernelInputForm').show();
                        break;
                }
                updateKernelButtonsState();
                $.selector_cache("#kernelInfoEmptyText").html(errorText);
            }
            $.selector_cache("#kernelInfoBody").fadeIn('fast');
        });

    };

    /**
     * Display kernel buttons linking to moderator if the user is owner of the current kernel
     */
    let updateKernelButtonsState = function () {
        if (_isAccountOwner && _isKernelConnected)
            $.selector_cache("#kernelButtons").show();
        else
            $.selector_cache("#kernelButtons").hide();
    };

    /**
     * Set the value for the reserved Kernel fields
     *
     * @param kernelInfo {Map} The information received from backend
     */
    let setKernelReservedFields = function (kernelInfo) {
        if (kernelInfo.has(kernelReservedKeys.img) && kernelInfo.get(kernelReservedKeys.img) !== "") {
            $.selector_cache("#kernelImg").hide();
            $.selector_cache("#kernelImg").attr('src', kernelInfo.get(kernelReservedKeys.img));
            onImgLoad("#kernelImg", function () {
                $.selector_cache("#kernelImg").fadeIn('fast');
            });

        }

        if (kernelInfo.has(kernelReservedKeys.name) && kernelInfo.get(kernelReservedKeys.name) !== "")
            $.selector_cache("#kernelName").html(kernelInfo.get(kernelReservedKeys.name));
        else
            $.selector_cache("#kernelName").html(kernelInfo.get('Kernel Information'));

        if (kernelInfo.has(kernelReservedKeys.isOrganisation) && kernelInfo.get(kernelReservedKeys.isOrganisation) === true)
            $.selector_cache("#kernelOrganization").html('This entity is an organization');
        else
            $.selector_cache("#kernelOrganization").html('This entity is not an organization');

        if (kernelInfo.has(kernelReservedKeys.phone) && kernelInfo.get(kernelReservedKeys.phone) !== '')
            $.selector_cache("#kernelPhone").html(kernelInfo.get(kernelReservedKeys.phone));
        else
            $.selector_cache("#kernelPhoneContainer").hide();

        if (kernelInfo.has(kernelReservedKeys.physicalAddress) && kernelInfo.get(kernelReservedKeys.physicalAddress) !== '') {
            $.selector_cache("#kernelAddress").html(kernelInfo.get(kernelReservedKeys.physicalAddress));
            $.selector_cache("#kernelAddress").attr('href', OSM_QUERY_LINK + kernelInfo.get(kernelReservedKeys.physicalAddress));
        } else
            $.selector_cache("#kernelAddressContainer").hide();

        if (kernelInfo.has(kernelReservedKeys.url) && kernelInfo.get(kernelReservedKeys.url) !== "") {
            $.selector_cache("#kernelUrl").attr('href', kernelInfo.get(kernelReservedKeys.url));
            $.selector_cache("#kernelUrl").html(kernelInfo.get(kernelReservedKeys.url));
        } else
            $.selector_cache("#kernelUrlContainer").hide();

        if (kernelInfo.has(kernelReservedKeys.mail) && kernelInfo.get(kernelReservedKeys.mail) !== "") {
            $.selector_cache("#kernelMail").attr('href', 'mailto:' + kernelInfo.get(kernelReservedKeys.mail));
            $.selector_cache("#kernelMail").html(kernelInfo.get(kernelReservedKeys.mail));
        } else
            $.selector_cache("#kernelMailContainer").hide();

        if (kernelInfo.has(kernelReservedKeys.version) && kernelInfo.get(kernelReservedKeys.version) !== "")
            $.selector_cache("#kernelVersion").html('Version ' + kernelInfo.get(kernelReservedKeys.version));
        else
            $.selector_cache("#kernelVersion").hide();
    };

    /**
     * Set the current connected kernel name, or address if not referenced by moderator
     *
     * @param kernelInfo {Map} The information received from backend
     */
    let setKernelConnectedAddress = function (kernelInfo) {
        if (kernelInfo.has(kernelReservedKeys.name))
            $.selector_cache('#kernelConnectedAddress').html("Currently connected to : '<strong>" + kernelInfo.get(kernelReservedKeys.name) + "</strong>'");
        else
            $.selector_cache('#kernelConnectedAddress').html("Currently connected to : '" + _currentKernelAddress + "'");
    };

    /**
     * Set the extra data for the kernel
     *
     * @param kernelInfo {Map} The information received from backend
     */
    let setKernelExtraData = function (kernelInfo) {
        if (kernelInfo.get(kernelReservedKeys.extraData) !== undefined && kernelInfo.get(kernelReservedKeys.extraData).size) {
            let $kernelExtraDataTable = $.selector_cache("#kernelExtraDataTable");
            for (let [key, value] of kernelInfo.get(kernelReservedKeys.extraData)) {
                $kernelExtraDataTable.append(
                    "<tr>\n" +
                    "<th scope='row'>" + capitalizeFirstLetter(key) + "</th>\n" +
                    "<td>" + value + "</td>\n" +
                    "</tr>");
            }
        } else
            $.selector_cache("#kernelAdditionalInfoZone").hide();
    };


    /**
     * Fill the moderator info table with information.
     * Display an error if info is undefined.
     *
     * @param info {Map} Result Map or undefined to use the error text.
     * @param errorText {String} Error text to display if result is undefined.
     */
    let setModeratorInfo = function (info, errorText) {
        $.selector_cache("#moderatorInfoBody").fadeOut('fast', function () {
            if (info !== undefined && info.size > 0) {
                log('Setting moderator info', TypeInfo.Info);
                $.selector_cache('#moderatorInfoZone').show();
                $.selector_cache('#moderatorInfoEmptyZone').hide();
                // Reserved fields
                if (info.has(moderatorReservedKeys.register))
                    $.selector_cache(".moderator-registration-link").attr('href', info.get(moderatorReservedKeys.register));
                else {
                    $.selector_cache(".moderator-registration-link").hide();
                    log('No moderator registration link provided', TypeInfo.Warning);
                }
                if (info.has(moderatorReservedKeys.contact))
                    $.selector_cache(".moderator-contact-link").attr('href', info.get(moderatorReservedKeys.contact));
                else {
                    $.selector_cache(".moderator-contact-link").hide();
                    log('No moderator contact link provided', TypeInfo.Warning);
                }
                if (info.has(moderatorReservedKeys.search))
                    $.selector_cache(".moderator-search-link").attr('href', info.get(moderatorReservedKeys.search));
                else {
                    $.selector_cache(".moderator-search-link").hide();
                    log('No moderator search link provided', TypeInfo.Warning);
                }

                // Other fields
                let $moderatorInfoTable = $.selector_cache("#moderatorInfoTable");
                let isInfoEmpty = true;
                for (let [key, value] of info) {
                    if (!isValueInObject(key, moderatorReservedKeys)) {
                        isInfoEmpty = false;
                        $moderatorInfoTable.append(
                            "<tr>\n" +
                            "<th scope='row'>" + capitalizeFirstLetter(key) + "</th>\n" +
                            "<td>" + value + "</td>\n" +
                            "</tr>");
                    }
                }
                if (isInfoEmpty)
                    $.selector_cache("#moderatorAdditionalInfoZone").hide();
            } else {
                $.selector_cache('#moderatorInfoZone').hide();
                $.selector_cache('#moderatorInfoEmptyZone').show();
                $.selector_cache("#moderatorInfoEmptyText").html(errorText);
            }
            $.selector_cache("#moderatorInfoBody").fadeIn('fast');
        });
    };

    let isValueInObject = function (val, object) {
        let isIn = false;
        for (let i of Object.keys(object)) {
            if (object[i] === val) {
                isIn = true;
                break;
            }
        }
        return isIn;
    };

    /**
     * Update the main UI components visibility under check and sign tabs,
     * based on current tab, wallet state and kernel ownership
     */
    let updateMainUIState = function () {
        if (!_isKernelConnected) {
            $.selector_cache('#mainUIContainer').hide();
            $.selector_cache('#accountsCard').hide();
            $.selector_cache('#loadingAccountsMessage').hide();
            setMainUIError(true, "Not connected",
                "Please connect to a kernel to start using the app", COLOR_CLASSES.info, false);
        } else if (_currentAppMode === APP_MODE.check) { // In check mode
            $.selector_cache('#mainUIContainer').show();
            $.selector_cache('#accountsCard').hide();
            $.selector_cache('#loadingAccountsMessage').hide();
            setMainUIError(false, "", "", undefined, false)
        } else if (_currentWalletState !== WALLET_STATE.injected) { // In sign mode without injected wallet
            $.selector_cache('#mainUIContainer').hide();
            $.selector_cache('#accountsCard').hide();
            $.selector_cache('#loadingAccountsMessage').hide();
            setMainUIError(true, "Wallet not injected",
                "Please make sure you have metamask installed.", COLOR_CLASSES.warning, true);
        } else if (_isLoadingAccounts) {
            $.selector_cache('#mainUIContainer').hide();
            $.selector_cache('#accountsCard').show();
            $.selector_cache('#loadingAccountsMessage').show();
            setMainUIError(false, '', '', undefined, false);
        } else if (!_isAccountOwner) { // In sign mode with an injected wallet but not kernel owner
            $.selector_cache('#mainUIContainer').hide();
            $.selector_cache('#accountsCard').show();
            $.selector_cache('#loadingAccountsMessage').hide();
            setMainUIError(true, 'Not owner',
                'You are not the owner of this kernel. You must be owner to sign documents.', COLOR_CLASSES.danger, false);
        } else { // In sign mode with injected wallet and kernel owner
            $.selector_cache('#mainUIContainer').show();
            $.selector_cache('#accountsCard').show();
            $.selector_cache('#loadingAccountsMessage').hide();
            setMainUIError(false, '', '', undefined, false);
        }
    };

    /**
     * Display an error jumbotron to warn the user about an error.
     *
     * @param state {Boolean} Should we display the error ?
     * @param title {String} The error title
     * @param message {String} The error text
     * @param color {COLOR_CLASSES} The color of the error
     * @param showMetamask {Boolean} Should we display the metamask download link ?
     */
    let setMainUIError = function (state, title, message, color, showMetamask) {
        if (state) {
            $.selector_cache('#signErrorText').html(message);
            $.selector_cache('#signErrorTitle').html(title);
            $.selector_cache('#signErrorJumbotron').show();
            setDOMColor($.selector_cache('#signErrorJumbotron'), color);
        } else {
            $.selector_cache('#signErrorJumbotron').hide();
        }
        if (showMetamask)
            $.selector_cache('#signErrorMetamask').show();
        else
            $.selector_cache('#signErrorMetamask').hide();
    };

    /* *********************************************************
     *                      UI UTILITY
     * *********************************************************/

    /**
     * Create a log message using the logMe utility function
     *
     * @param message The message to display
     * @param type The message type (error, warning or normal)
     */
    let log = function (message, type) {
        logMe(UIManagerPrefix, message, type);
    };

    /**
     * Enables or disabled the check button.
     *
     */
    this.updateCheckButtonState = function () {
        let disabled = false;
        if (_currentAppMode === APP_MODE.check)
            disabled = !UI.canCheck();
        else
            disabled = !UI.canSign();
        $.selector_cache('#checkButton').attr('disabled', disabled);
    };

    /**
     * Reset the file selection (unselect all items and reset details box).
     */
    let fileListResetSelection = function () {
        $(".file-selected").removeClass('file-selected'); // unselect all items
        UI.displayFileProps(undefined);
    };

    /**
     * Get the current list based on the current tab
     *
     * @return {Map} The map representing the list
     */
    let getCurrentList = function () {
        return _itemList.get(_currentAppMode).get(_currentTab);
    };

    /**
     * Get the list for the specified app mode and tab
     *
     * @param appType {APP_MODE} The app type to select
     * @param tabType {TAB_TYPE} The tab type to use
     * @return {Map} The map representing the list
     */
    let getList = function (appType, tabType) {
        return _itemList.get(appType).get(tabType)
    };

    /**
     * Get an item in the current list, by giving its id
     *
     * @param id {Number} This item's index
     * @return {ListItem} The list item object
     */
    let getCurrentListItem = function (id) {
        return getCurrentList().get(id);
    };

    /**
     * Check if the list of the current tab is empty
     *
     * @return {boolean} Is the list empty ?
     */
    let isCurrentItemListEmpty = function () {
        return getCurrentList().size === 0;
    };

    /**
     * Get the item at the specified index in the current list, based on the current tab
     *
     * @param index {number} the index the item should be at
     * @return {ListItem/undefined} The lis item object or undefined if there is no item at the given index
     */
    let getCurrentListItemByIndex = function (index) {
        let iterator = getCurrentList().values();
        let item = iterator.next().value;
        let i = 0;
        while (item !== undefined && i !== index) {
            item = iterator.next().value;
            i++;
        }
        return i === index ? item : undefined;
    };

    /**
     * Get the item identified by its index in every item list, starting by the current for performance reasons
     *
     * @param index {Number} The unique item identifier
     * @return {ListItem} The item found, or undefined
     */
    let getItemInAll = function (index) {
        let finalItem = getCurrentListItem(index);
        if (finalItem === undefined) {
            for (let tabList of _itemList.values()) {
                for (let itemList of tabList.values()) {
                    for (let item of itemList.values()) {
                        if (item.getIndex() === index)
                            finalItem = item;
                    }
                }
            }
        }
        return finalItem;
    };

    /* *********************************************************
     *                       PUBLIC FUNCTIONS
     * *********************************************************/

    /**
     * Set the app verbose mode.
     * Display a message indicating its state not matter the verbose mode.
     *
     * @param enabled {Boolean} Whether to enable the verbose mode or not.
     */
    this.setVerbose = function (enabled) {
        _isVerbose = true; // enable verbose to display the state
        log('Verbose set to: ' + enabled, TypeInfo.Info);
        _isVerbose = enabled; // set the value to the one desired
    };

    /**
     * Get the current verbose mode.
     *
     * @return {boolean}
     */
    this.getVerbose = function () {
        return _isVerbose;
    };

    /**
     * Check if all conditions are met to start file checking.
     * To be able to check, the item list must not be empty, and the user must be connected to a kernel.
     *
     * @return {boolean} Can we start the checking procedure ?
     */
    this.canCheck = function () {
        return _isKernelConnected && getCurrentList().size;
    };

    /**
     * check if all conditions are met to start signing
     *
     * @return {boolean} Can we start the signing procedure ?
     */
    this.canSign = function () {
        return _isKernelConnected && _currentWalletState === WALLET_STATE.injected && getCurrentList().size;
    };

    /**
     * Clone the file list item template into the right tab.
     *
     * @param id {String} The id of the DOM element to create.
     * It must en with _{index} with the unique file index to be able to retrieve the file.
     * @param type {TAB_TYPE} The type to create
     */
    this.createListItemFromTemplate = function (id, type) {
        $tabListItemTemplates[type].contents().clone().attr('id', id).appendTo($tabHolders[type]);
    };

    /**
     * Removes the file associated to the index from the list.
     * If we are removing the last file, display the empty file list template.
     *
     * @param index {Number} The file unique index.
     * @param isSelected {Boolean} Whether the file is currently selected.
     */
    this.removeItemFromList = function (index, isSelected) {
        $("#" + getCurrentListItem(index).getId()).remove();
        getCurrentList().delete(index);
        if (isCurrentItemListEmpty()) {
            UI.resetProgress();
            resetTabZone(_currentTab);
            UI.updateCheckButtonState();
            UI.setUIButtonState(UI_STATE.none);
        }
        if (isSelected) {
            UI.displayFileProps(undefined);
        }
        updateDisplayIds(_currentTab);
    };

    /**
     * Display file properties in the details card.
     *
     * @param index {Number} The file unique index.
     */
    this.displayFileProps = function (index) {
        let item = getCurrentListItem(index);
        setBlockchainInfoErrorText('', COLOR_CLASSES.none); // reset color
        if (item !== undefined) {
            $.selector_cache('#detailsEmptyZone').hide();
            $.selector_cache('#detailsZone').show();
            setDOMColor($.selector_cache('#generalInfoBody'), item.getCardColor());

            let file = undefined;
            if (_currentTab === TAB_TYPE.file)
                file = item.getFile();
            fillFileProp(file);
            setupItemInputFields(item);
            fillReservedFields(item);
            // Display blockchain edit fields if the item has no signatures
            if (_currentAppMode === APP_MODE.sign && item.getType() === TypeElement.Fake && item.getNumSign() === 0) {
                log('Displaying Blockchain edit fields', TypeInfo.Info);
                $.selector_cache('#fileBlockchainInfoEmptyZone').hide();
                $.selector_cache('#fileBlockchainInfoZone').hide();
                $.selector_cache('#fileBlockchainEditInfoZone').show();
                // Reset table
                $.selector_cache("#fileBlockchainEditExtraDataTable").html('');
                setupSourceInputField(item);
                createDocFamilyDropDown(item);
                createSavedInputFields(item);
                setupExtraDataControlButtons(item);
            } else if (item.getInformation() !== undefined && item.getInformation().size) {
                fillBlockchainInfoFields(item);
                if (item.getExtraData() !== undefined && item.getExtraData().size)
                    fillBlockchainExtraDataFields(item);
                else
                    $.selector_cache("#fileBlockchainExtraDataZone").hide();
            } else {
                // No blockchain information to display
                $.selector_cache('#fileBlockchainInfoEmptyZone').show();
                $.selector_cache('#fileBlockchainInfoZone').hide();
                $.selector_cache('#fileBlockchainEditInfoZone').hide();
                setBlockchainInfoMessage(item);
            }
        } else {
            $.selector_cache('#detailsEmptyZone').show();
            $.selector_cache('#detailsZone').hide();
        }
        $('[data-toggle="tooltip"]').tooltip(); // Enable created tooltips
    };

    /**
     * Fill in the file property fields if we have a valid file
     *
     * @param file {File} The file to display information from
     */
    let fillFileProp = function (file) {
        if (file !== undefined) { // display file properties only if we have a file
            log('Displaying file properties', TypeInfo.Info);
            $.selector_cache("#itemNameProp").html(file.name);
            $.selector_cache("#itemTypeProp").attr('class', getMimeTypeIcon(file));
            $.selector_cache("#fileSizeProp").html(humanFileSize(file.size));
            let date = new Date(file.lastModified);
            $.selector_cache("#fileDateProp").html(date);
            $.selector_cache(".file-specific-info").show();
        } else
            $.selector_cache(".file-specific-info").hide();
    };

    let fillReservedFields = function (item) {
        // display generic info
        if (item.getHash() !== '')
            $.selector_cache("#itemHashProp").html(item.getHash());
        else
            $.selector_cache("#itemHashProp").html('Not yet calculated');
        if (item.getType() !== TypeElement.Unknown) {
            $.selector_cache("#itemStatusProp").show();
            $.selector_cache("#itemStatusProp").html(ITEM_STATE_TEXT[item.getType()]);
        } else
            $.selector_cache("#itemStatusProp").hide();

        // Set the number of signatures needed
        if (item.getNeededSign() > 0 && item.getType() !== TypeElement.Unknown) {
            $.selector_cache("#itemNumSignProp").html(item.getNumSign() + "/" + item.getNeededSign());
            $.selector_cache("#itemNumSignContainer").show();
        } else
            $.selector_cache("#itemNumSignContainer").hide();
        // Set the Tx url if available
        if (item.getTxUrl() !== '') {
            $.selector_cache("#itemTxUrlProp").attr('href', item.getTxUrl());
            $.selector_cache("#itemTxUrlProp").show();
        } else
            $.selector_cache("#itemTxUrlProp").hide();
    };

    let setupItemInputFields = function (item) {
        if (!(item instanceof FileListItem)) {
            $.selector_cache("#itemNameProp").html(item.getTitle());
            if (item instanceof TextListItem) {
                $.selector_cache("#itemTypeProp").attr('class', 'fas fa-align-left');
                $.selector_cache("#itemTextInput").val(item.getText());
                $.selector_cache("#itemTextInputContainer").show();
                $.selector_cache("#itemHashInputContainer").hide();
                $.selector_cache("#itemTextInput").off('change keyup paste'); // Remove previous event handlers
                $.selector_cache("#itemTextInput").on('change keyup paste', function () {
                    item.setText($.selector_cache("#itemTextInput").val());
                    if (item.getType() !== TypeElement.Unknown) {
                        item.setType(TypeElement.Unknown);
                        item.setHash('');
                        UI.displayFileProps(item.getIndex());
                        UI.resetProgress();
                        UI.setUIButtonState(UI_STATE.none);
                    }
                });
                $.selector_cache("#itemTextInput").focus();
            } else { // We have a hash
                $.selector_cache("#itemTypeProp").attr('class', 'fas fa-hashtag');
                $.selector_cache("#itemTextInputContainer").hide();
                $.selector_cache("#itemHashInput").val(item.getHash());
                $.selector_cache("#itemHashInputContainer").show();
                $.selector_cache("#itemHashInput").off('change keyup paste'); // Remove previous event handlers
                $.selector_cache("#itemHashInput").on('change keyup paste', function () {
                    item.setHash($.selector_cache("#itemHashInput").val());
                    if (item.getType() !== TypeElement.Unknown) {
                        item.setType(TypeElement.Unknown);
                        UI.displayFileProps(item.getIndex());
                        UI.resetProgress();
                        UI.setUIButtonState(UI_STATE.none);
                    }
                });
                $.selector_cache("#itemHashInput").focus();
            }
        } else {
            $.selector_cache("#itemTextInputContainer").hide();
            $.selector_cache("#itemHashInputContainer").hide();
        }
    };

    let fillBlockchainInfoFields = function (item) {
        log('Displaying Blockchain information', TypeInfo.Info);
        $.selector_cache('#fileBlockchainInfoEmptyZone').hide();
        $.selector_cache('#fileBlockchainInfoZone').show();
        $.selector_cache('#fileBlockchainEditInfoZone').hide();
        // Reset table
        $.selector_cache("#fileBlockchainInfoTable").html('');
        for (let [key, value] of item.getInformation()) {
            if (key === elementReservedKeys.documentFamily)
                value = getCompatibleFamily()[value]; // Get the document family string
            $.selector_cache("#fileBlockchainInfoTable").append(
                "<tr>\n" +
                "<th scope='row'>" + capitalizeFirstLetter(key) + "</th>\n" +
                "<td>" + value + "</td>\n" +
                "</tr>");
        }
    };

    let fillBlockchainExtraDataFields = function (item) {
        $.selector_cache("#fileBlockchainExtraDataZone").show();
        // Reset table
        $.selector_cache("#fileBlockchainExtraDataTable").html('');
        for (let [key, value] of item.getExtraData()) {
            $.selector_cache("#fileBlockchainExtraDataTable").append(
                "<tr>\n" +
                "<th scope='row'>" + capitalizeFirstLetter(key) + "</th>\n" +
                "<td>" + value + "</td>\n" +
                "</tr>");
        }
    };

    let setBlockchainInfoMessage = function (item) {
        let message = _blockchainErrorMsg.get(_currentAppMode).get(item.getType());
        if (message !== undefined)
            setBlockchainInfoErrorText(message[0], message[1]);
        else
            setBlockchainInfoErrorText('', COLOR_CLASSES.none);
    };

    let setBlockchainInfoErrorText = function (text, color) {
        $.selector_cache('#fileBlockchainInfoEmptyText').html(text);
        setDOMColor($.selector_cache('#fileBlockchainInfoCard'), color);
    };

    /**
     *
     * @param item {ListItem}
     */
    let setupSourceInputField = function (item) {
        if (item.getInformation().has(elementReservedKeys.source))
            $.selector_cache("#infoSourceInput").val(item.getInformation().get(elementReservedKeys.source));
        else
            $.selector_cache("#infoSourceInput").val('');

        $.selector_cache("#infoSourceInput").off('change keyup paste');
        $.selector_cache("#infoSourceInput").on('change keyup paste', function () {
            let val = $.selector_cache("#infoSourceInput").val();
            if (val !== '')
                item.getInformation().set(elementReservedKeys.source, val);
            else
                item.getInformation().delete(elementReservedKeys.source);
        });
    };

    /**
     * Generate the dropdown menu based on kernel document family.
     *
     * @param item {ListItem} The item we are editing
     */
    let createDocFamilyDropDown = function (item) {
        let dropdownButton = $.selector_cache("#docFamilyDropdownButton");
        let dropdownMenu = $.selector_cache("#docFamilyDropdownMenu");
        let docFamilyArray = getCompatibleFamily();
        // clear menu
        dropdownMenu.html('');
        // Generate dropdown menu entries
        for (let i = 0; i < getCompatibleFamily().length; i++) {
            dropdownMenu.append("<button class='dropdown-item btn' id='dropdownButton" + i + "'>" + docFamilyArray[i] + "</button>");
            $("#dropdownButton" + i).on('click', function () {
                dropdownButton.html(docFamilyArray[i]);
                if (i !== 0)
                    item.getInformation().set(elementReservedKeys.documentFamily, i);
                else
                    item.getInformation().delete(elementReservedKeys.documentFamily);
            });
        }
        // Set default value
        if (item.getInformation().has(elementReservedKeys.documentFamily))
            dropdownButton.html(docFamilyArray[item.getInformation().get(elementReservedKeys.documentFamily)]);
        else
            dropdownButton.html(docFamilyArray[0]);
    };

    /**
     * Create input fields with values from the item.
     * @param item {ListItem} The list item to take values from
     */
    let createSavedInputFields = function (item) {
        item.clearCustomExtraData();
        $.selector_cache('#fileBlockchainEditExtraDataTable').html(''); // Clear the list to recreate it
        if (item.getCustomExtraData().length === 0)
            createNewInputFields(item, 0, '', '');
        else {
            for (let i = 0; i < item.getCustomExtraData().length; i++) {
                if (item.getCustomExtraData()[i] !== undefined) {
                    createNewInputFields(item, i, item.getCustomExtraData()[i][0], item.getCustomExtraData()[i][1])
                }
            }
        }

    };

    /**
     * Create a new input fields in the edit blockchain zone.
     *
     * @param item {ListItem} The list item we are editing
     * @param index {Number} The index of the last input field created
     * @param key {String} The default value for the key input field
     * @param value {String} The default value for the value input field
     */
    let createNewInputFields = function (item, index, key, value) {
        $.selector_cache("#fileBlockchainEditExtraDataTable").append(
            "<tr id='inputRowExtra" + index + "'>\n" +
            "<th><input class='form-control' id='inputKeyExtra" + index + "' type='text' placeholder='Enter a key'></th>\n" +
            "<td><textarea class='form-control' id='inputValueExtra" + index + "' placeholder='Enter a value'></textarea></td>\n" +
            "<td><button class='btn btn-danger delete-extra-button' id='inputDeleteExtra" + index + "'" +
            " data-toggle='tooltip' data-placement='bottom' title='Delete this row'>" +
            "<i class='fas fa-trash'></i></button></td>\n" +
            "</tr>");
        let inputKey = $("#inputKeyExtra" + index);
        let inputValue = $("#inputValueExtra" + index);
        $("#inputDeleteExtra" + index).on('click', function () {
            item.setCustomExtraData(index, undefined);
            $("#inputRowExtra" + index).remove();
        });
        inputKey.val(key);
        inputValue.val(value);
        item.setCustomExtraData(index, [key, value]);
        inputKey.on('change keyup paste', function () {
            item.setCustomExtraData(index, [inputKey.val(), inputValue.val()]);
        });
        inputValue.on('change keyup paste', function () {
            item.setCustomExtraData(index, [inputKey.val(), inputValue.val()]);
        });
    };

    /**
     * Setup event handlers for blockchain edit buttons
     * @param item {ListItem} The list item we are editing
     */
    let setupExtraDataControlButtons = function (item) {
        // Reset event handlers
        $.selector_cache("#editExtraDataAddButton").off('click');
        $.selector_cache("#editExtraDataClearButton").off('click');
        // Set event handlers
        $.selector_cache("#editExtraDataAddButton").on('click', function () {
            createNewInputFields(item, item.getCustomExtraData().length, '', '');
        });
        $.selector_cache("#editExtraDataClearButton").on('click', function () {
            for (let i = 0; i < item.getCustomExtraData().length; i++) {
                if (item.getCustomExtraData()[i] !== undefined)
                    $("#inputRowExtra" + i).remove();
            }
            item.clearCustomExtraData();
            createNewInputFields(item, 0, '', '');
        });
    };

    /**
     * Initialize the UI with default value.
     */
    this.initUI = function () {
        this.setVerbose(false);
        log('Successfully Loaded');
        setAppVersion();
        setDefaultFieldValues();
        detectAppMode();
        setUIMode(_currentAppMode, true);
        UI.updateCheckButtonState();
        UI.setUIButtonState(UI_STATE.none);
        setKernelInfo(undefined, undefined);
        setModeratorInfo(undefined, 'Connection in progress...');
        for (let i of Object.keys(TAB_TYPE)) {
            resetTabZone(TAB_TYPE[i]);
        }
        $('[data-toggle="tooltip"]').tooltip(); // enable Popper.js tooltips
        UI.displayFileProps(undefined);
        registerEvents();
        UI.resetProgress();
        this.updateAccounts(undefined);
        _canUseDropZone = true;
    };

    let setAppVersion = function () {
        $.selector_cache('#webAppVersion').html(APP_VERSION);
    };

    /* *********************************************************
     *                    MASTER INTERACTIONS
     * *********************************************************/

    /**
     * Set the network type field text based on the connection type.
     * Display additional information using tooltips.
     *
     * @param connectionType {TypeConnection} The type of connection to display.
     * @param infoType {TypeInfo} The type of information, to choose which tooltip to display.
     */
    this.updateNetworkConnectedUI = function (connectionType, infoType) {
        // reset badge
        $.selector_cache('#networkTypeField').attr('class', 'badge');
        log('Setting network connected UI', TypeInfo.Info);
        switch (infoType) {
            case TypeInfo.Good:
                $.selector_cache('#networkTypeField').attr('data-original-title', 'You are connected to a public server');
                $.selector_cache('#networkTypeField').addClass('badge-success');
                _defaultModeratorAddress = officialBlockchainEliteModerator;
                break;
            case TypeInfo.Warning:
                $.selector_cache('#networkTypeField').attr('data-original-title', 'You are connected to a test server');
                $.selector_cache('#networkTypeField').addClass('badge-warning');
                _defaultModeratorAddress = ropstenBlockchainEliteModerator;
                break;
            case TypeInfo.Critical:
                $.selector_cache('#networkTypeField').attr('data-original-title', 'Could not connect');
                $.selector_cache('#networkTypeField').addClass('badge-danger');
                _defaultModeratorAddress = '';
                break;
        }
        for (let type in TypeConnection) {
            if (TypeConnection[type] === connectionType) {
                $.selector_cache('#networkTypeField').html(type);
                break;
            }
        }
        _currentModeratorAddress = _defaultModeratorAddress;
    };

    /**
     * Set the connection type field text based on the given state.
     * Possible values are injected and infura
     *
     * @param isInjected {Boolean} Whether the wallet is injected or infura.
     */
    this.updateWalletStateUI = function (isInjected) {
        // reset badge
        $.selector_cache('#connectionTypeField').attr('class', 'badge');
        log('Setting wallet injected state to: ' + isInjected, TypeInfo.Info);
        if (isInjected) {
            $.selector_cache('#connectionTypeField').html('Wallet Injected');
            $.selector_cache('#connectionTypeField').addClass('badge-success');
            $.selector_cache('#connectionTypeField').attr('data-original-title', 'You are using an injected wallet');
            _currentWalletState = WALLET_STATE.injected;
        } else {
            $.selector_cache('#connectionTypeField').html('Infura');
            $.selector_cache('#connectionTypeField').addClass('badge-success');
            $.selector_cache('#connectionTypeField').attr('data-original-title', 'You are using an infura wallet');
            _currentWalletState = WALLET_STATE.infura;
        }
        updateMainUIState();
        UI.updateCheckButtonState();

        tryReadyUI();
    };

    /**
     * Show a dialog to the user asking for connection confirmation
     *
     * @param status {resultQueryStatus} The status of the connection
     * @param revokedReason {String} The reason
     */
    this.promptKernelConnectionWarnAnswer = function (status, revokedReason) {
        let message = '';
        switch (status) {
            case resultQueryStatus.revoked:
                message = 'The Kernel you are connecting to has been revoked by the moderator.\n' +
                    'This mean the moderator does not recognize the kernel anymore and cannot prove its identity.\n' +
                    'revoked reason: ' + revokedReason;
                break;
            case resultQueryStatus.initialized:
                message = 'The Moderator knows the Kernel you are connecting to, but has not yet passed security confirmation.' +
                    'As such, it cannot provide information on its identity.';
                break;
            case resultQueryStatus.unknown:
                message = 'The Kernel you are connecting is unknown to the Moderator. It is impossible to prove its identity.';
                break;
        }
        if (message !== '') {
            message += '<br>Are you sure you want to connect?';
            $.confirm({
                title: 'Security information',
                content: message,
                theme: JQUERY_CONFIRM_THEME,
                type: 'orange',
                icon: 'fas fa-exclamation-triangle',
                escapeKey: 'cancel',
                columnClass: 'medium',
                typeAnimated: true,
                buttons: {
                    confirm: {
                        keys: ['enter'],
                        btnClass: 'btn-orange',
                        action: function () {
                            log('Connection insecure');
                            updateKernelObject(_currentKernelAddress, undefined);
                        }
                    },
                    cancel: function () {
                        UI.updateKernelConnection(undefined, undefined);
                    },
                }
            });
        }
    };

    /**
     * Set the kernel connection information.
     *
     * @param connectionStatus {TypeInfo} The connection status
     * @param moderatorInfo {Map} The connection information
     * Reserved keys :
     * 'connection-status' for a TypeInfo describing the connection.
     * 'img' for the image url. Not setting this key will not show an image.
     * 'extra-data' for a map containing additional data.
     *
     */
    this.updateKernelConnection = function (connectionStatus, moderatorInfo) {
        _isAccountsListAvailable = false; // Kernel owners may change
        resetAllElements(); // Element signatures are different from each kernel
        setKernelConnectionLoading(false);
        $.selector_cache('#collapseSignature').collapse('show');
        switch (connectionStatus) {
            case TypeInfo.Good:
                $.selector_cache('#kernelConnectionInfoIcon').attr('class', 'fas fa-check-circle text-success');
                setDOMColor($.selector_cache('#kernelInfoHeader'), COLOR_CLASSES.success);
                setKernelInfo(moderatorInfo, TypeInfo.Good);
                if (_currentAppMode === APP_MODE.sign)
                    askForAccounts();
                _isKernelConnected = true;
                break;
            case TypeInfo.Warning:
                $.selector_cache('#kernelConnectionInfoIcon').attr('class', 'fas fa-exclamation-triangle text-warning');
                $.selector_cache('#kernelConnectedAddress').html("Currently connected to : '" + _currentKernelAddress + "'");
                setDOMColor($.selector_cache('#kernelInfoHeader'), COLOR_CLASSES.warning);
                setKernelInfo(undefined, TypeInfo.Warning);
                if (_currentAppMode === APP_MODE.sign)
                    askForAccounts();
                _isKernelConnected = true;
                break;
            case TypeInfo.Critical:
                $.selector_cache('#kernelConnectionInfoIcon').attr('class', 'fas fa-times text-danger');
                $.selector_cache('#kernelConnectedAddress').html("Could not connect to '" + _currentKernelAddress + "'");
                setDOMColor($.selector_cache('#kernelInfoHeader'), COLOR_CLASSES.danger);
                setKernelInfo(undefined, TypeInfo.Critical);
                _isKernelConnected = false;
                break;
            default:
                $.selector_cache('#kernelConnectionInfoIcon').attr('class', 'fas fa-question');
                $.selector_cache('#kernelConnectedAddress').html("Not Connected");
                setDOMColor($.selector_cache('#kernelInfoHeader'), COLOR_CLASSES.secondary);
                setKernelInfo(undefined, undefined);
                _isKernelConnected = false;
                break;
        }
        UI.updateCheckButtonState();
        updateMainUIState();
    };

    /**
     * Set the moderator info.
     *
     * @param connectionInfo {Map} Map containing moderator info.
     *  Reserved keys :
     * 'connection-status' for a TypeInfo describing the connection.
     * 'registration_link' for a link to the registration page.
     * 'contact_link' for a link to the contact page.
     */
    this.updateModeratorConnection = function (connectionInfo) {
        let connectionType = TypeInfo.Info;
        if (connectionInfo !== undefined && connectionInfo.has(moderatorReservedKeys.status))
            connectionType = connectionInfo.get(moderatorReservedKeys.status);

        _isModeratorConnected = true;
        setModeratorConnectionLoading(false);
        log('Updating moderator input UI', TypeInfo.Info);
        UI.updateKernelConnection(undefined, undefined); // Reset the kernel connection
        switch (connectionType) {
            case TypeInfo.Good:
                $.selector_cache('#moderatorConnectionInfoIcon').attr('class', 'fas fa-check-circle text-success');
                if (_currentModeratorAddress === _defaultModeratorAddress)
                    $.selector_cache('#moderatorConnectedAddress').html("Currently connected to default: " +
                        "<strong>Blockchain Élite ULCDocuments Official</strong>");
                else
                    $.selector_cache('#moderatorConnectedAddress').html("Currently connected to: " +
                        "'<strong>" + _currentModeratorAddress + "</strong>'");
                setDOMColor($.selector_cache('#moderatorInfoHeader'), COLOR_CLASSES.success);
                setModeratorInfo(connectionInfo, "");
                break;
            case TypeInfo.Critical:
                _isKernelConnected = false;
                $.selector_cache('#moderatorConnectionInfoIcon').attr('class', 'fas fa-times text-danger');
                $.selector_cache('#moderatorConnectedAddress').html("Could not connect to '" + _currentModeratorAddress + "'");
                setDOMColor($.selector_cache('#moderatorInfoHeader'), COLOR_CLASSES.danger);
                setModeratorInfo(undefined, 'Connection could not be established, falling back to default');
                break;
        }
        tryReadyUI();
        UI.updateCheckButtonState();
    };

    /**
     * Update the element associated to index.
     *
     * @param index {Number} The file unique index.
     * @param elementInfo {Map} Map containing file information
     */
    this.updateElement = function (index, elementInfo) {
        let elementType = TypeElement.Unknown;
        if (elementInfo !== undefined && elementInfo.has(elementReservedKeys.status)) {
            elementType = elementInfo.get(elementReservedKeys.status);
            // Separate basic info and extra data, and remove reserved keys from basic info
            let extraData = undefined;
            if (elementInfo.has(elementReservedKeys.extraData)) {
                extraData = elementInfo.get(elementReservedKeys.extraData);
                elementInfo.delete(elementReservedKeys.extraData);
            }
            let signNeed = 0;
            let signNum = 0;
            if (elementInfo.has(fetchElementReservedKeys.signNeed) && elementInfo.get(fetchElementReservedKeys.signNeed) > 0) {
                signNeed = elementInfo.get(fetchElementReservedKeys.signNeed);
                elementInfo.delete(fetchElementReservedKeys.signNeed);
                if (elementInfo.has(fetchElementReservedKeys.signPending)) {
                    signNum = elementInfo.get(fetchElementReservedKeys.signPending);
                    elementInfo.delete(fetchElementReservedKeys.signPending);
                }
            }
            elementInfo.delete(elementReservedKeys.status);
            getCurrentListItem(index).setNumSign(signNum);
            getCurrentListItem(index).setNeededSign(signNeed);
            getCurrentListItem(index).setInformation(elementInfo);
            getCurrentListItem(index).setExtraData(extraData);
        } else {
            log('Element status unavailable, resetting to default.');
            getCurrentListItem(index).setInformation(undefined);
            getCurrentListItem(index).setExtraData(undefined);
        }
        _itemsProcessedCounter += 1;
        getCurrentListItem(index).setType(elementType);
        checkNextItem();
    };

    /**
     * Update the hash of the element associated to index.
     *
     * @param index {Number} The item unique index.
     * @param hash {String} The hash to display.
     */
    this.updateElementHash = function (index, hash) {
        getCurrentListItem(index).setHash(hash);
    };

    /**
     * Updates the account list with the specified Map.
     * This map must be of format {string : boolean}, with string being the accounts address
     * and boolean whether the account owns the current kernel
     * The first element in the map is considered the current account.
     *
     * @param accountsMap {Map} The accounts list
     */
    this.updateAccounts = function (accountsMap) {
        $.selector_cache('#accountsListBody').fadeOut('fast', function () {
            if (accountsMap !== undefined && accountsMap.size !== 0) {
                let isFirstElem = true;
                $.selector_cache('#accountsListEmptyZone').hide();
                $.selector_cache('#accountsListZone').show();
                for (let [key, value] of accountsMap) {
                    let rowClass = "alert-danger";
                    let rowOwnership = "Not Owner";
                    if (value) {
                        rowClass = "alert-success";
                        rowOwnership = "Owner";
                    }
                    if (isFirstElem) { // This is the current account
                        $.selector_cache('#accountState').html(rowOwnership);
                        $.selector_cache('#accountListHeader').attr('class', 'card-header ' + rowClass);
                        if (value) { // This account is the kernels owner
                            $.selector_cache('#collapseAccounts').collapse('hide');
                            _isAccountOwner = true;
                        } else {
                            $.selector_cache('#collapseAccounts').collapse('show');
                            _isAccountOwner = false;
                        }
                        $.selector_cache('#accountsTable').html( // Reset the zone
                            '<tr>' +
                            '<th scope="row">Account Address</th>' +
                            '<th>Ownership</th>' +
                            '</tr>');
                        $.selector_cache("#accountsTable").append(
                            "<tr class='" + rowClass + "'>\n" +
                            "<td scope=\"row\">" + key + " (Current Account)" + "</td>\n" +
                            "<td>" + rowOwnership + "</td>\n" +
                            "</tr>");
                        isFirstElem = false;
                    } else { // Other accounts
                        $.selector_cache("#accountsTable").append(
                            "<tr class='" + rowClass + "'>\n" +
                            "<td scope=\"row\">" + key + "</td>\n" +
                            "<td>" + rowOwnership + "</td>\n" +
                            "</tr>");
                    }
                }
                _isAccountsListAvailable = true;
            } else {
                log("Accounts list invalid", TypeInfo.Warning);
                $.selector_cache('#accountsListEmptyZone').show();
                $.selector_cache('#accountsListBody').hide();
                $.selector_cache('#accountState').html("None");
                setDOMColor($.selector_cache('#accountListHeader'), COLOR_CLASSES.secondary);
                _isAccountOwner = false;
            }
            _isLoadingAccounts = false;
            updateKernelButtonsState();
            updateMainUIState();
            $.selector_cache('#accountsListBody').fadeIn('fast');
        });
    };

    /**
     * Update the element to tell the user the transaction is currently being processed
     *
     * @param index {Number} The item unique index
     * @param url {String} The Tx url
     */
    this.updateTransactionTx = function (index, url) {
        let item = getCurrentListItem(index);
        item.setTxUrl(url);
        item.setType(TypeElement.TxProcessing);
        signNextItem();
    };

    /**
     * Update the element to tell the user the transatcion has been completed, successfully or not
     *
     * @param index {Number} The item unique index
     * @param state {Boolean} Whether the transaction was successful or not
     */
    this.updateTransactionState = function (index, state) {
        // We unlocked the UI after sending the transactions,
        // so we must find the element in the right tab and check if it isn't removed
        let item = getItemInAll(index);
        if (item !== undefined) {
            if (state) {
                item.setNumSign(item.getNumSign() + 1);
                item.setType(TypeElement.TransactionSuccess);
            } else {
                item.setType(TypeElement.TransactionFailure);
                if (_currentUiState === UI_STATE.signing) { // Unlock UI if we failed whille signing (user reject transaction)
                    updateProgress(-1, false);
                    UI.setUIButtonState(UI_STATE.none);
                }
            }

        } else
            log('Item with index ' + index + ' has been removed and cannot be updated', TypeInfo.Warning);
    };

}


/* *********************************************************
 *                      INIT
 **********************************************************/

let UI = new UIManager();
UI.initUI();
