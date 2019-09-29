"use strict";

// tile shape and color
function Tetromino(shape, x, y, orientation, color) {
    this.shape = shape;
    this.shape.color = color;
    this.x = x;
    this.y = y;
    this.orientation = orientation;
}

// tile prototype
Tetromino.prototype = {
    // first prototype
    first: function (x0, y0, orientation, fn, doBreak) {
        let row = 0, col = 0, result = false, blocks = this.shape.blocks[orientation];
        for (let bit = 0x8000; bit > 0; bit = bit >> 1) {
            if (blocks & bit) {
                result = fn(x0 + col, y0 + row);
                if (doBreak && result)
                    return result;
            }
            if (++col === 4) {
                col = 0;
                ++row;
            }
        }
        return result;
    },
    // all prototypes
    all: function (fn) {
        this.first(this.x, this.y, this.orientation, fn, false);
    }
}

// application elements
const elements = {
    main: element("main"),
    game: element("game"),
    nav: element("toolbar"),
    left: element("left"),
    right: element("right"),
    board: element("board"),
    upcoming: element("upcoming"),
    sectionClutter: element("sectionClutter"),
    checkboxClutter: element("checkboxClutter"),
    clutterSelector: element("clutterSelector"),
    promptText: element("prompt"),
    scoreText: element("score"),
    rowsText: element("rows"),
    pausedText: element("paused"),
    helpWindow: element("help"),
    helpImageHelp: element("id.help"),
    helpImageClose: element("id.close-help"),
    settingsImage: element("id.settings"),
    statusVerb: element("statusVerb"),
    statusKeyName: element("statusKeyName")
};

// application layout
const layout = {
    blockSize: 0,

    //resize application body
    resizeBody: function () {
        elements.left.style.paddingLeft = settingsEditor.sizeStyle(layoutMetrics.spacing.inside);
        elements.left.style.paddingRight = settingsEditor.sizeStyle(layoutMetrics.spacing.inside);
        elements.left.style.paddingTop = settingsEditor.sizeStyle(layoutMetrics.spacing.inside * layoutMetrics.relativeVerticalInfoPanelPadding);
        elements.left.style.paddingBottom = settingsEditor.sizeStyle(layoutMetrics.spacing.inside * layoutMetrics.relativeVerticalInfoPanelPadding);
        elements.right.style.paddingRight = settingsEditor.sizeStyle(layoutMetrics.spacing.inside);
        elements.right.style.paddingTop = settingsEditor.sizeStyle(layoutMetrics.spacing.inside);
        elements.right.style.paddingBottom = settingsEditor.sizeStyle(layoutMetrics.spacing.inside);
        let verticalSize = window.innerHeight - 2 * layoutMetrics.spacing.outsize - 2 * layoutMetrics.spacing.inside - 2 * layoutMetrics.spacing.border;
        this.blockSize = Math.floor(verticalSize / this.effectiveSettings.gameSizeInBlocks.y);
        const adjustedVerticalSize = this.blockSize * this.effectiveSettings.gameSizeInBlocks.y;
        const horizontalSize = this.blockSize * this.effectiveSettings.gameSizeInBlocks.x;
        elements.board.style.height = settingsEditor.sizeStyle(adjustedVerticalSize);
        let boardWidth = this.blockSize * this.effectiveSettings.gameSizeInBlocks.x;
        elements.board.style.width = settingsEditor.sizeStyle(boardWidth);
        let upcomingWidth = this.blockSize * layoutMetrics.upcomingPreviewSize;
        elements.upcoming.style.height = settingsEditor.sizeStyle(upcomingWidth);
        elements.upcoming.style.width = settingsEditor.sizeStyle(upcomingWidth);
        setText(elements.statusVerb, UiTexts.statusWordSet.continue);
        let width1 = elements.promptText.offsetWidth;
        setText(elements.statusVerb, UiTexts.statusWordSet.start);
        setText(elements.statusKeyName, this.effectiveSettings.key.start.display);
        let width2 = elements.promptText.offsetWidth;
        const leftWidth = maximum(upcomingWidth, width1, width2, upcomingWidth);
        elements.left.style.width = settingsEditor.sizeStyle(leftWidth);
        elements.main.style.borderWidth = settingsEditor.sizeStyle(layoutMetrics.spacing.border);
        elements.board.width = elements.board.clientWidth;
        elements.board.height = elements.board.clientHeight;
        elements.upcoming.width = elements.upcoming.clientWidth;
        elements.upcoming.height = elements.upcoming.clientHeight;
        rendering.invalidate();
    },
    resize: function () { try { this.resizeBody(); } catch (e) { showException(e); } },

    //display Keyboard
    showKeyboard: function (settings) {
        for (let index in settings.key) {
            const keyboardItem = settings.key[index];
            for (let id in keyboardItem.ids)
                document.getElementById(keyboardItem.ids[id]).innerHTML = keyboardItem.display;
        }
        elements.helpImageHelp.title = settings.key.help.display + UiTexts.toolBayKeyboardHintSpacer + elements.helpImageHelp.title;
        elements.helpImageClose.title = settings.key.help.display + UiTexts.toolBayKeyboardHintSpacer + elements.helpImageClose.title;
        elements.settingsImage.title = settings.key.settings.display + UiTexts.toolBayKeyboardHintSpacer + elements.settingsImage.title;
    }

};

// game functionality
const game = {
    actions: { rotateRight: 0, rotateLeft: 1, right: 2, down: 3, left: 4, bottom: 5 },
    orientation: { min: 0, max: 3 },
    states: { cancelled: 0, paused: 1, playing: 2, current: 0 },
    blocks: [],
    queue: [],
    duration: 0,
    score: 0,
    rows: 0,
    delay: 0,
    current: null,
    next: null,

    // initialize clutter levels
    initializeClutterLevels: function () {
        checkboxClutter.checked = this.effectiveSettings.clutterOptionSet.clutterEnabledDefault;
        for (let percent = this.effectiveSettings.clutterOptionSet.min; percent <= this.effectiveSettings.clutterOptionSet.max; percent += this.effectiveSettings.clutterOptionSet.step) {
            const option = document.createElement("option");
            option.textContent = percent + "%";
            option.value = percent / 100.0;
            if (percent == this.effectiveSettings.clutterOptionSet.default)
                option.selected = true;
            elements.clutterSelector.appendChild(option);
        }
    },	

    setState: function (aState) {
        this.states.current = aState;
        rendering.invalidateState();
        const disabledControls = aState == this.states.playing || aState == this.states.paused;
        window.focus();
        if (disabledControls) { // only needed for Mozilla
            elements.checkboxClutter.blur();
            elements.clutterSelector.blur();
        }
        elements.checkboxClutter.disabled = disabledControls;
        elements.clutterSelector.disabled = disabledControls;
    },
    //start or continue game
    startContinue: function () {
        if (this.states.current === this.states.cancelled) {
            this.reset();
            if (elements.checkboxClutter.checked)
                this.autoClutter();
        }
        this.setState(this.states.playing);
    },
    cancel: function () { this.setState(this.states.cancelled); },
    pause: function () { this.setState(this.states.paused); },

    // game perimeter
    willHitObstacle: function (tetromino, x0, y0, orientation) {
        const gameSizeInBlocks = this.effectiveSettings.gameSizeInBlocks;
        return tetromino.first(x0, y0, orientation, function (x, y) {
            if ((x < 0) || (x >= gameSizeInBlocks.x) || (y < 0) || (y >= gameSizeInBlocks.y) || game.getBlock(x, y))
                return true;
        }, true);
    },

     //randomise tiles
    randomTetromino: function () {
        const chosen = this.effectiveSettings.tetrominoSet[randomInt(0, this.effectiveSettings.tetrominoSet.length - 1)];
        const color = this.effectiveSettings.tetrominoColor[chosen.colorIndex];
        return new Tetromino(chosen, randomInt(0, this.effectiveSettings.gameSizeInBlocks.x - chosen.size), 0, 0, color);
    },

    setScore: function (n) { this.score = n; rendering.invalidateScore(); },
    addScore: function (n) { this.setScore(this.score + n); },
    setRows: function (n) { this.rows = n; this.delay = Math.max(this.effectiveSettings.delays.min, this.effectiveSettings.delays.start - (this.effectiveSettings.delays.decrement * this.rows)); rendering.invalidateRows(); },
    addRows: function (n) { this.setRows(this.rows + n); },
    getBlock: function (x, y) { return (this.blocks && this.blocks[x] ? this.blocks[x][y] : null); },
    setBlock: function (x, y, shape) { this.blocks[x] = this.blocks[x] || []; this.blocks[x][y] = shape; rendering.invalidate(); },
    clearQueue: function () { this.queue = []; },
    setCurrentTetromino: function (t) { this.current = t || this.randomTetromino(); rendering.invalidate(); },
    setNextTetromino: function (t) { this.next = t || this.randomTetromino(); rendering.invalidateUpcoming(); },

    reset: function () {
        this.duration = 0;
        this.setScore(0);
        this.setRows(0);
        this.blocks = []; rendering.invalidate();
        this.clearQueue();
        this.setCurrentTetromino(this.next);
        this.setNextTetromino();
    },

    // update tile
    update: function (dTime) {
        if (this.states.current != this.states.playing) return;
        this.handle(this.queue.shift());
        this.duration += dTime;
        if (this.duration > this.delay) { this.duration -= this.delay; this.drop(true); }
    },

    // move tile
    move: function (direction) {
        let x = this.current.x, y = this.current.y;
        switch (direction) {
            case this.actions.right: x += 1; break;
            case this.actions.left: x -= 1; break;
            case this.actions.down: y += 1; break;
        }
        if (!this.willHitObstacle(this.current, x, y, this.current.orientation)) {
            this.current.x = x;
            this.current.y = y;
            rendering.invalidate();
            return true;
        } else
            return false;
    },

    // rotate tile
    rotate: function (left) {
        const newOrientation = left ?
            (this.current.orientation === this.orientation.min ? this.orientation.max : this.current.orientation - 1)
            :
            (this.current.orientation === this.orientation.max ? this.orientation.min : this.current.orientation + 1);
        if (this.willHitObstacle(this.current, this.current.x, this.current.y, newOrientation)) return;
        this.current.orientation = newOrientation;
        rendering.invalidate();
    },

    // update tile
    drop: function (updateScore) {
        if (this.move(this.actions.down)) return;
        if (updateScore) this.addScore(this.effectiveSettings.scoreRules.addOnDrop(this.rows, this.score));
        this.dropTetromino();
        this.removeLines();
        this.setCurrentTetromino(this.next);
        this.setNextTetromino(this.randomTetromino());
        this.clearQueue();
        if (this.willHitObstacle(this.current, this.current.x, this.current.y, this.current.orientation))
            this.cancel();
    },

    //drop Tile one step down
    dropTetromino: function () {
        this.current.all(function (x, y) {
            game.setBlock(x, y, game.current.shape);
        });
    },

    // drop tile to the bottom
    dropDown: function (updateScore) {
        while (this.move(this.actions.down)) { }
        this.drop(updateScore);
    },

    // get top most block
    getTopmostBlock: function () {
        for (let y = 0; y < this.effectiveSettings.gameSizeInBlocks.y; ++y)
            for (let x = 0; x < this.effectiveSettings.gameSizeInBlocks.x; ++x)
                if (this.getBlock(x, y))
                    return y;
        return this.effectiveSettings.gameSizeInBlocks.y;
    },

    // auto clutter application
    autoClutter: function () {
        while (true) {
            const level = this.effectiveSettings.gameSizeInBlocks.y - this.getTopmostBlock() - 1;
            if (level / this.effectiveSettings.gameSizeInBlocks.y >= elements.clutterSelector.value) break;
            this.dropDown(false);
        }
    },

    // remove line
    removeLine: function (lineLocation) {
        for (let y = lineLocation; y >= 0; --y)
            for (let x = 0; x < this.effectiveSettings.gameSizeInBlocks.x; ++x)
                this.setBlock(x, y, (y === 0) ? null : this.getBlock(x, y - 1));
    },

     // remove lines
    removeLines: function () {
        let complete, removedLines = 0;
        for (let y = this.effectiveSettings.gameSizeInBlocks.y; y > 0; --y) {
            complete = true;
            for (let x = 0; x < this.effectiveSettings.gameSizeInBlocks.x; ++x)
                if (!this.getBlock(x, y))
                    complete = false;
            if (complete) {
                this.removeLine(y);
                y += 1; // recheck same line
                ++removedLines;
            }
        }
        if (removedLines > 0) {
            this.addRows(removedLines);
            this.addScore(this.effectiveSettings.scoreRules.addOnRemovedLines(removedLines, this.rows, this.score));
        }
    },

    // handle
    handle: function (action) {
        switch (action) {
            case this.actions.left: this.move(action); break;
            case this.actions.right: this.move(action); break;
            case this.actions.rotateRight: this.rotate(false); break;
            case this.actions.rotateLeft: this.rotate(true); break;
            case this.actions.down: this.drop(true); break;
            case this.actions.bottom: this.dropDown(true); break;
        }
    },

    // click application body
    clickBody: function (event) {
        if (event.target.constructor == HTMLAnchorElement) return;
        if (event.target.constructor == HTMLImageElement) return;
        if (indirectChildOf(event.target, elements.sectionClutter)) return;
        if (this.states.current === this.states.playing)
            this.pause();
        else
            this.startContinue();
    },

    click: function (event) { try { this.clickBody(event); } catch (e) { showException(e); } },

    settingsHandler: function () { window.location = fileNames.settingsEditor; },

    keydownBody: function (event) {
        if (rendering.showingHelp && event.keyCode != this.effectiveSettings.key.help.keyCode)
            return;
        if (this.specialKeySet.has(event.keyCode)) {
            if (event.keyCode === this.effectiveSettings.key.help.keyCode) rendering.help();
            if (event.keyCode === this.effectiveSettings.key.settings.keyCode) this.settingsHandler();
            event.preventDefault();
            return;
        }	
        let handled = false;
        if (this.states.current === this.states.playing) {
            switch (event.keyCode) {
                case this.effectiveSettings.key.left.keyCode: this.queue.push(this.actions.left); handled = true; break;
                case this.effectiveSettings.key.right.keyCode: this.queue.push(this.actions.right); handled = true; break;
                case this.effectiveSettings.key.rotate.keyCode:
                    const action = event.ctrlKey ? this.actions.rotateLeft : this.actions.rotateRight;
                    this.queue.push(action);
                    handled = true;
                    break;
                case this.effectiveSettings.key.down.keyCode: this.queue.push(this.actions.down); handled = true; break;
                case this.effectiveSettings.key.dropDown.keyCode:
                    // using this.repeatedKeyDropDown because event.repeat, reportedly, is not currently supported by some smartphone/tablet browsers:
                    if (!this.repeatedKeyDropDown) {
                        this.repeatedKeyDropDown = true;
                        this.queue.push(this.actions.bottom);
                    }
                    handled = true;
                    break;
                case this.effectiveSettings.key.cancel.keyCode: this.cancel(); handled = true; break;
                case this.effectiveSettings.key.start.keyCode: this.pause(); handled = true; break;
            }
        } else if (event.keyCode === this.effectiveSettings.key.start.keyCode) {
            this.startContinue();
            handled = true;
        }
        if (handled)
            event.preventDefault(); // prevent arrow keys from scrolling the page (supported in IE9+ and all other browsers)
    },

    repeatedKeyDropDown: false, //using it because event.repeat, reportedly, is not currently supported by some smartphone/tablet browsers

    keyupBody: function (event) {
        if (indirectChildOf(event.target, elements.sectionClutter))
            return;
        if (event.keyCode == this.effectiveSettings.key.dropDown.keyCode)
            this.repeatedKeyDropDown = false;
        event.preventDefault();
    },

    keydown: function (event) { try { this.keydownBody(event); } catch (e) { showException(e); } },

    keyup: function (event) { try { this.keyupBody(event); } catch (e) { showException(e); } }

};

// rendering
const rendering = {
    boardContext: elements.board.getContext("2d"),
    upcomingContext: elements.upcoming.getContext("2d"),
    invalid: { board: true, upcoming: true, score: true, rows: true, state: true },
    invalidate: function () { this.invalid.board = true; },
    invalidateUpcoming: function () { this.invalid.upcoming = true; },
    invalidateScore: function () { this.invalid.score = true; },
    invalidateRows: function () { this.invalid.rows = true; },
    invalidateState: function (controls) { this.invalid.state = true; },
    showingHelp: false,

    // show help image
    showHelpImage: function (doShow) {
        if (doShow) {
            elements.helpImageHelp.style.display = "inline";
            elements.helpImageClose.style.display = "none";
        } else {
            elements.helpImageHelp.style.display = "none";
            elements.helpImageClose.style.display = "inline";
        }
    },
    // initialise help
    initializeHelp: function () {
        const versionElement = element("version");
        versionElement.textContent = this.effectiveSettings.version;
    },
    // help functionality
    help: function () {
        this.showHelpImage(this.showingHelp);
        setVisibility(elements.helpWindow, this.showingHelp = !this.showingHelp);
    },

    // draw tile
    draw: function () {
        const drawTetromino = function (context, tetromino) {
            tetromino.all(function (x, y) {
                drawBlock(context, x, y, tetromino.shape.color);
            });
        };
        const drawTetrominoAt = function (context, tetromino, location) {
            tetromino.all(function (x, y) {
                drawBlock(context, x + location.x - tetromino.x, y + location.y - tetromino.y, tetromino.shape.color);
            });
        };
        // draw block
        const drawBlock = function (context, x, y, color) {
            context.fillStyle = color;
            context.fillRect(x * layout.blockSize, y * layout.blockSize, layout.blockSize, layout.blockSize);
            context.strokeRect(x * layout.blockSize, y * layout.blockSize, layout.blockSize, layout.blockSize)
        };
        // finer lines
        const finerLines = function (context) {
            context.lineWidth = 1;
            context.translate(0.5, 0.5);
        };
        // draw up coming 
        const drawUpcoming = function (context) {
            if (!this.invalid.upcoming) return;
            if (game.states.current != game.states.playing) return;
            const padding = (layoutMetrics.upcomingPreviewSize - game.next.shape.size) / 2; // half-arsed attempt at centering next tetromino display
            context.save();
            finerLines(context);
            context.clearRect(-1, -1, layoutMetrics.upcomingPreviewSize * layout.blockSize + 1, layoutMetrics.upcomingPreviewSize * layout.blockSize + 1);
            drawTetrominoAt(context, game.next, { x: padding, y: padding });
            context.restore();
            this.invalid.upcoming = false;
        };
        // draw board
        const drawBoard = function (context) {
            if (!this.invalid.board) return;
            context.save();
            finerLines(context);
            context.clearRect(-1, -1, context.canvas.width + 1, context.canvas.height + 1);
            if (game.states.current === game.states.playing)
                drawTetromino(context, game.current);
            let block;
            for (let y = 0; y < this.effectiveSettings.gameSizeInBlocks.y; y++)
                for (let x = 0; x < this.effectiveSettings.gameSizeInBlocks.x; x++)
                    if (block = game.getBlock(x, y)) {
                        drawBlock(context, x, y, block.color);
                    }
            context.strokeRect(0, 0, context.canvas.width - 1, context.canvas.height - 1); // board boundary
            context.restore();
            this.invalid.board = false;
        };
        // draw score
        const drawScore = function () {
            if (!this.invalid.score) return;
            setText(elements.scoreText, game.score);
            this.invalid.score = false;
        };
        // draw rows
        const drawRows = function () {
            if (!this.invalid.rows) return;
            setText(elements.rowsText, game.rows);
            this.invalid.rows = false;
        };
        // draw state
        const drawState = function () {
            if (!this.invalid.state) return;
            setText(elements.statusVerb, game.states.current === game.states.paused ? UiTexts.statusWordSet.continue : UiTexts.statusWordSet.start);
            setVisibility(elements.pausedText, game.states.current === game.states.paused);
            setVisibility(elements.promptText, game.states.current != game.states.playing);
            this.invalid.state = false;
        };
        drawBoard.call(this, this.boardContext);
        drawUpcoming.call(this, this.upcomingContext);
        drawScore.call(this);
        drawRows.call(this);
        drawState.call(this);
    }

};

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function element(id) { return document.getElementById(id); }
function indirectChildOf(child, parent) { if (child == parent) return true; while ((child = child.parentNode) && child !== parent); return !!child; }
function now() { return new Date().getTime(); }
function hide(object, noDisplay) { object.style.visibility = "hidden"; if (noDisplay) object.style.display = "none"; }
function show(object) { object.style.visibility = null; }

 // setVisibility
function setVisibility(object, visible) {
    if (visible) {
        show(object);
        object.style.display = "block";
    } else
        hide(object);
}
// set text
function setText(object, text) { object.innerHTML = text; }

// set maximum
function maximum() {
    let big = Number.NEGATIVE_INFINITY;
    for (let argument of arguments) {
        let value = argument;
        if (value >= big)
            big = value;
    }
    return big;
}

// show exception
function showException(exception) {
    //return;
    alert(exception.name + ":\n" + exception.message +
        "\n" + "\nLine: " + exception.lineNumber + "; column: " + (exception.columnNumber + 1) +
        "\n\n" + exception.stack);
}

try {
    (function () {
        const effectiveSettings = getSettings();
        layout.effectiveSettings = effectiveSettings;
        game.effectiveSettings = effectiveSettings;
        rendering.effectiveSettings = effectiveSettings;
        layout.showKeyboard(effectiveSettings);
        game.specialKeySet = new Set([effectiveSettings.key.help.keyCode, effectiveSettings.key.settings.keyCode]);
        document.body.title = document.title;
        if (!window.requestAnimationFrame)
            window.requestAnimationFrame =
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function (callback, element) { window.setTimeout(callback, 1000 / 60); }
        game.initializeClutterLevels();
        rendering.initializeHelp();
        layout.resize();
        game.reset();
        window.onresize = function () { layout.resize(); };
        window.onkeydown = function (event) { game.keydown(event); };
        window.onkeyup = function (event) { game.keyup(event); };
        window.onclick = function (event) { game.click(event); };
        elements.helpWindow.onclick = function () { rendering.help(); };
        elements.helpImageHelp.onclick = function () { rendering.help(); };
        elements.helpImageClose.onclick = function () { rendering.help(); };
        let after, before = now();
        (function frame() {
            after = now();
            game.update(Math.min(1, (after - before) / 1000.0));
            rendering.draw();
            before = after;
            requestAnimationFrame(frame, elements.board);
        })();
        elements.settingsImage.onclick = game.settingsHandler;
        elements.checkboxClutter.focus();
    })();
} catch (e) { showException(e); }
