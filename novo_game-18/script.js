/*jslint browser: true, undef: true, eqeqeq: true, nomen: true, white: true */
/*global window: false, document: false, Modernizr: false, $: false */

/*
 * fix looped audio
 * add fruits + levels
 * fix what happens when a ghost is eaten (should go back to base)
 * do proper ghost mechanics (blinky/wimpy etc)
 */

var NONE        = 4,
    UP          = 3,
    LEFT        = 2,
    DOWN        = 1,
    RIGHT       = 11,
    WAITING     = 5,
    PAUSE       = 6,
    PLAYING     = 7,
    COUNTDOWN   = 8,
    EATEN_PAUSE = 9,
    DYING       = 10,
    QUESTION_PAUSE = 12,
    Pacman      = {};

Pacman.FPS = 30;
Pacman.MAP = window.MAZE_LAYOUT;
Pacman.WALLS = window.MAZE_WALLS;
Pacman.ghostSpeedMultiplier = 1;

var GameConfig = {
    "settings" : null,
    "phases"   : []
};

Pacman.clone = function (value) {
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(function (item) { return Pacman.clone(item); });
    }
    var key, result = {};
    for (key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            result[key] = Pacman.clone(value[key]);
        }
    }
    return result;
};

Pacman.Ghost = function (game, map, colour) {

    var position  = null,
        direction = null,
        eatable   = null,
        eaten     = null,
        due       = null,
        speedCarry = 0,
        shapeOffsets = generateShapeOffsets(colour || "", 24);
    
    function getNewCoord(dir, current) { 
        
        var base   = isVunerable() ? 1 : isHidden() ? 4 : 2,
            speed  = computeStep(base),
            xSpeed = (dir === LEFT && -speed || dir === RIGHT && speed || 0),
            ySpeed = (dir === DOWN && speed || dir === UP && -speed || 0);
    
        return {
            "x": addBounded(current.x, xSpeed),
            "y": addBounded(current.y, ySpeed)
        };
    };

    /* Collision detection(walls) is done when a ghost lands on an
     * exact block, make sure they dont skip over it 
     */
    function addBounded(x1, x2) { 
        var rem    = x1 % 10, 
            result = rem + x2;
        if (rem !== 0 && result > 10) {
            return x1 + (10 - rem);
        } else if(rem > 0 && result < 0) { 
            return x1 - rem;
        }
        return x1 + x2;
    };

    function getSpeedMultiplier() {
        var value = Pacman.ghostSpeedMultiplier;
        if (typeof value !== "number" || !isFinite(value)) {
            return 1;
        }
        if (value < 0) {
            return 0;
        }
        return value;
    }

    function computeStep(base) {
        var multiplier = getSpeedMultiplier(),
            raw = (base || 0) * multiplier + speedCarry,
            step = Math.floor(raw);
        if (step < 0) {
            step = 0;
        }
        speedCarry = raw - step;
        if (speedCarry < 0) {
            speedCarry = 0;
        }
        return step;
    }
    
    function isVunerable() { 
        return eatable !== null;
    };
    
    function isDangerous() {
        return eaten === null;
    };

    function isHidden() { 
        return eatable === null && eaten !== null;
    };
    
    function isValidDirection(dir) {
        return dir === LEFT || dir === RIGHT || dir === UP || dir === DOWN;
    }

    function getRandomDirection(exclude) {
        var pool = [LEFT, RIGHT, UP, DOWN],
            blocked = {},
            i;
        if (Array.isArray(exclude)) {
            for (i = 0; i < exclude.length; i += 1) {
                blocked[exclude[i]] = true;
            }
        }
        var options = [];
        for (i = 0; i < pool.length; i += 1) {
            if (!blocked[pool[i]]) {
                options.push(pool[i]);
            }
        }
        if (!options.length) {
            options = pool.slice();
        }
        return options[Math.floor(Math.random() * options.length)];
    }

    function determineNextDirection(options) {
        options = options || {};
        var blocked = Array.isArray(options.blocked) ? options.blocked.slice() : [],
            blockedLookup = {},
            aiDirection = null,
            candidate;

        blocked.forEach(function (dir) {
            blockedLookup[dir] = true;
        });

        if (game && typeof game.getNextDirection === "function") {
            try {
                aiDirection = game.getNextDirection({
                    "position": position,
                    "direction": direction,
                    "isVulnerable": isVunerable(),
                    "isEaten": eaten !== null,
                    "blocked": blocked
                });
            } catch (ignore) {
                aiDirection = null;
            }
        }

        if (!isValidDirection(aiDirection) || blockedLookup[aiDirection]) {
            candidate = getRandomDirection(blocked);
        } else {
            candidate = aiDirection;
        }
        if (!isValidDirection(candidate) || blockedLookup[candidate]) {
            candidate = getRandomDirection(blocked);
        }
        if (!isValidDirection(candidate) || blockedLookup[candidate]) {
            if (isValidDirection(direction) && !blockedLookup[direction]) {
                candidate = direction;
            } else {
                candidate = LEFT;
            }
        }
        return candidate;
    }

    function reset() {
        eaten = null;
        eatable = null;
        position = {"x": 90, "y": 80};
        direction = getRandomDirection();
        due = determineNextDirection();
        speedCarry = 0;
    };
    
    function onWholeSquare(x) {
        return x % 10 === 0;
    };
    
    function oppositeDirection(dir) { 
        return dir === LEFT && RIGHT ||
            dir === RIGHT && LEFT ||
            dir === UP && DOWN || UP;
    };

    function makeEatable() {
        direction = oppositeDirection(direction);
        eatable = game.getTick();
    };

    function eat() { 
        eatable = null;
        eaten = game.getTick();
    };

    function pointToCoord(x) {
        return Math.round(x / 10);
    };

    function nextSquare(x, dir) {
        var rem = x % 10;
        if (rem === 0) { 
            return x; 
        } else if (dir === RIGHT || dir === DOWN) { 
            return x + (10 - rem);
        } else {
            return x - rem;
        }
    };

    function onGridSquare(pos) {
        return onWholeSquare(pos.y) && onWholeSquare(pos.x);
    };

    function secondsAgo(tick) { 
        return (game.getTick() - tick) / Pacman.FPS;
    };

    function generateShapeOffsets(key, count) {
        var result = [],
            hash = 0,
            i;

        key = String(key || "");
        for (i = 0; i < key.length; i += 1) {
            hash = (hash * 31 + key.charCodeAt(i)) | 0;
        }
        if (hash === 0) {
            hash = 1;
        }
        count = Math.max(8, count || 16);
        for (i = 0; i < count; i += 1) {
            hash = (hash * 1664525 + 1013904223) >>> 0;
            result.push(((hash / 4294967295) * 2) - 1);
        }
        return result;
    }

    function getColour() { 
        if (eatable) { 
            if (secondsAgo(eatable) > 5) { 
                return game.getTick() % 20 > 10 ? "#FFFFFF" : "#0000BB";
            } else { 
                return "#0000BB";
            }
        } else if(eaten) { 
            return "#222";
        } 
        return colour;
    };

    function draw(ctx) {
        var s = map.blockSize,
            halfCell = s / 2,
            margin = s * 0.08,
            maxRadius = halfCell - margin,
            centerX = ((position.x / 10) * s) + halfCell,
            centerY = ((position.y / 10) * s) + halfCell,
            tick = game.getTick(),
            wobbleSeed = (position.x + position.y) / 10,
            cx = centerX + Math.cos((tick / 11) + wobbleSeed) * (s * 0.025),
            cy = centerY + Math.sin((tick / 8) + wobbleSeed) * (s * 0.03),
            bodyColour = getColour(),
            outlineColour = "rgba(12, 15, 35, 0.3)",
            highlightAlpha = 0.22,
            pointCount = shapeOffsets.length,
            baseRadius = maxRadius * 0.92,
            dynamicScale = Math.sin((tick / 12) + wobbleSeed) * 0.05,
            points = [],
            minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity,
            i;

        if (eatable && secondsAgo(eatable) > 8) {
            eatable = null;
        }

        if (eaten && secondsAgo(eaten) > 3) { 
            eaten = null;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(centerX - halfCell + 1, centerY - halfCell + 1, s - 2, s - 2);
        ctx.clip();

        if (pointCount < 8) {
            pointCount = 8;
        }

        for (i = 0; i < pointCount; i += 1) {
            var angle = (Math.PI * 2 * i) / pointCount,
                staticOffset = shapeOffsets[i % shapeOffsets.length] * 0.33,
                wobble = Math.sin((tick / 6.5) + (angle * 3) + wobbleSeed) * 0.18,
                bottomBoost = Math.max(0, Math.sin(angle) * 0.3),
                radius = baseRadius * (1 + staticOffset + wobble * 0.6 + bottomBoost * 0.5 + dynamicScale);

            radius = Math.max(baseRadius * 0.6, Math.min(maxRadius, radius));

            var px = cx + Math.cos(angle) * radius,
                py = cy + Math.sin(angle) * radius;

            if (py > centerY && py > centerY + halfCell - 1) {
                py = centerY + halfCell - 1;
            }
            if (py < centerY - halfCell + 1) {
                py = centerY - halfCell + 1;
            }
            if (px < centerX - halfCell + 1) {
                px = centerX - halfCell + 1;
            } else if (px > centerX + halfCell - 1) {
                px = centerX + halfCell - 1;
            }

            points.push({"x": px, "y": py});
            if (px < minX) { minX = px; }
            if (px > maxX) { maxX = px; }
            if (py < minY) { minY = py; }
            if (py > maxY) { maxY = py; }
        }

        if (points.length) {
            var len = points.length;

            ctx.beginPath();
            for (i = 0; i < len; i += 1) {
                var curr = points[i],
                    next = points[(i + 1) % len],
                    midX = (curr.x + next.x) / 2,
                    midY = (curr.y + next.y) / 2;
                if (i === 0) {
                    ctx.moveTo(midX, midY);
                }
                ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
            }
            ctx.closePath();
        }

        if (eaten) {
            bodyColour = "#2d3149";
            highlightAlpha = 0.12;
        }

        ctx.fillStyle = bodyColour;
        if (eaten) {
            ctx.globalAlpha = 0.55;
        }
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.lineWidth = s * 0.035;
        ctx.strokeStyle = outlineColour;
        ctx.stroke();

        if (points.length) {
            var bodyWidth = Math.max(2, maxX - minX),
                bodyHeight = Math.max(2, maxY - minY);

            ctx.globalAlpha = highlightAlpha;
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.ellipse(cx - bodyWidth * 0.22,
                        minY + bodyHeight * 0.35,
                        bodyWidth * 0.18,
                        bodyHeight * 0.33,
                        -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            var eyeCenterY = minY + bodyHeight * 0.42,
                eyeOffsetX = bodyWidth * 0.25,
                eyeRadiusX = bodyWidth * 0.14,
                eyeRadiusY = bodyHeight * 0.26,
                pupilRadius = Math.min(eyeRadiusX, eyeRadiusY) * (eaten ? 0.38 : 0.5),
                dir = direction;

            if (dir !== LEFT && dir !== RIGHT && dir !== UP && dir !== DOWN) {
                dir = RIGHT;
            }

            var pupilTravel = pupilRadius * (eaten ? 0.65 : 0.9),
                pupilOffsetX = 0,
                pupilOffsetY = 0;

            switch (dir) {
            case LEFT:
                pupilOffsetX = -pupilTravel;
                break;
            case RIGHT:
                pupilOffsetX = pupilTravel;
                break;
            case UP:
                pupilOffsetY = -pupilTravel * 0.7;
                break;
            case DOWN:
                pupilOffsetY = pupilTravel * 0.7;
                break;
            }

            var eyeLeftX = cx - eyeOffsetX,
                eyeRightX = cx + eyeOffsetX,
                pupilColour = eaten ? "#d8e4ff" : "#162036";

            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.ellipse(eyeLeftX, eyeCenterY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
            ctx.ellipse(eyeRightX, eyeCenterY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = pupilColour;
            ctx.beginPath();
            ctx.ellipse(eyeLeftX + pupilOffsetX, eyeCenterY + pupilOffsetY,
                        pupilRadius, pupilRadius * 1.05, 0, 0, Math.PI * 2);
            ctx.ellipse(eyeRightX + pupilOffsetX, eyeCenterY + pupilOffsetY,
                        pupilRadius, pupilRadius * 1.05, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
            ctx.beginPath();
            ctx.arc(eyeLeftX + pupilOffsetX - pupilRadius * 0.45,
                    eyeCenterY + pupilOffsetY - pupilRadius * 0.45,
                    pupilRadius * 0.25, 0, Math.PI * 2);
            ctx.arc(eyeRightX + pupilOffsetX - pupilRadius * 0.45,
                    eyeCenterY + pupilOffsetY - pupilRadius * 0.45,
                    pupilRadius * 0.25, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    };

    function pane(pos) {

        if (pos.y === 100 && pos.x >= 190 && direction === RIGHT) {
            return {"y": 100, "x": -10};
        }
        
        if (pos.y === 100 && pos.x <= -10 && direction === LEFT) {
            return position = {"y": 100, "x": 190};
        }

        return false;
    };
    
    function move(ctx) {
        
        var oldPos = position,
            onGrid = onGridSquare(position),
            npos   = null;
        
        if (due !== direction) {
            
            npos = getNewCoord(due, position);
            
            if (onGrid &&
                map.isFloorSpace({
                    "y":pointToCoord(nextSquare(npos.y, due)),
                    "x":pointToCoord(nextSquare(npos.x, due))})) {
                direction = due;
            } else {
                npos = null;
            }
        }
        
        if (npos === null) {
            npos = getNewCoord(direction, position);
        }
        
        if (!isValidDirection(due)) {
            due = determineNextDirection();
        }

        if (onGrid &&
            map.isWallSpace({
                "y" : pointToCoord(nextSquare(npos.y, direction)),
                "x" : pointToCoord(nextSquare(npos.x, direction))
            })) {
            
            var blockedDirections = [direction];
            due = determineNextDirection({"blocked": blockedDirections});
            return move(ctx);
        }

        position = npos;        
        
        var tmp = pane(position);
        if (tmp) { 
            position = tmp;
        }
        
        due = determineNextDirection();
        
        return {
            "new" : position,
            "old" : oldPos
        };
    };
    
    return {
        "eat"         : eat,
        "isVunerable" : isVunerable,
        "isDangerous" : isDangerous,
        "makeEatable" : makeEatable,
        "reset"       : reset,
        "move"        : move,
        "draw"        : draw
    };
};

Pacman.User = function (game, map, opts) {
    
    var position  = null,
        direction = null,
        lastDirection = LEFT,
        eaten     = null,
        due       = null, 
        lives     = null,
        score     = 5,
        keyMap    = {},
        options   = opts || {},
        initialLives = options.initialLives || 3,
        maxLives     = options.maxLives || 5;
    
    keyMap[KEY.ARROW_LEFT]  = LEFT;
    keyMap[KEY.ARROW_UP]    = UP;
    keyMap[KEY.ARROW_RIGHT] = RIGHT;
    keyMap[KEY.ARROW_DOWN]  = DOWN;

    function addScore(nScore) { 
        score += nScore;
        if (score >= 10000 && score - nScore < 10000) { 
            lives += 1;
        }
    };

    function theScore() { 
        return score;
    };

    function loseLife() { 
        lives -= 1;
    };

    function gainLife(limit) {
        var cap = typeof limit === "number" ? limit : maxLives;
        lives += 1;
        if (typeof cap === "number") {
            lives = Math.min(lives, cap);
        }
    };

    function setInitialLives(value, limit) {
        initialLives = value;
        if (typeof limit === "number") {
            maxLives = limit;
        }
        lives = initialLives;
    };

    function getLives() {
        return lives;
    };

    function initUser() {
        score = 0;
        lives = initialLives;
        newLevel();
    }
    
    function newLevel() {
        resetPosition();
        eaten = 0;
    };
    
    function resetPosition() {
        position = {"x": 90, "y": 120};
        direction = LEFT;
        lastDirection = LEFT;
        due = LEFT;
    };
    
    function reset() {
        initUser();
        resetPosition();
    };        
    
    function keyDown(e) {
        if (typeof keyMap[e.keyCode] !== "undefined") { 
            due = keyMap[e.keyCode];
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        return true;
	};

    function getNewCoord(dir, current) {   
        return {
            "x": current.x + (dir === LEFT && -2 || dir === RIGHT && 2 || 0),
            "y": current.y + (dir === DOWN && 2 || dir === UP    && -2 || 0)
        };
    };

    function onWholeSquare(x) {
        return x % 10 === 0;
    };

    function pointToCoord(x) {
        return Math.round(x/10);
    };
    
    function nextSquare(x, dir) {
        var rem = x % 10;
        if (rem === 0) { 
            return x; 
        } else if (dir === RIGHT || dir === DOWN) { 
            return x + (10 - rem);
        } else {
            return x - rem;
        }
    };

    function next(pos, dir) {
        return {
            "y" : pointToCoord(nextSquare(pos.y, dir)),
            "x" : pointToCoord(nextSquare(pos.x, dir)),
        };                               
    };

    function onGridSquare(pos) {
        return onWholeSquare(pos.y) && onWholeSquare(pos.x);
    };

    function isOnSamePlane(due, dir) { 
        return ((due === LEFT || due === RIGHT) && 
                (dir === LEFT || dir === RIGHT)) || 
            ((due === UP || due === DOWN) && 
             (dir === UP || dir === DOWN));
    };

    function move(ctx) {
        
        var npos        = null, 
            nextWhole   = null, 
            oldPosition = position,
            block       = null;
        
        if (due !== direction) {
            npos = getNewCoord(due, position);
            
            if (isOnSamePlane(due, direction) || 
                (onGridSquare(position) && 
                 map.isFloorSpace(next(npos, due)))) {
                direction = due;
            } else {
                npos = null;
            }
        }

        if (npos === null) {
            npos = getNewCoord(direction, position);
        }
        
        if (onGridSquare(position) && map.isWallSpace(next(npos, direction))) {
            direction = NONE;
        }

        if (direction === NONE) {
            return {"new" : position, "old" : position};
        }
        
        lastDirection = direction;

        if (npos.y === 100 && npos.x >= 190 && direction === RIGHT) {
            npos = {"y": 100, "x": -10};
        }
        
        if (npos.y === 100 && npos.x <= -12 && direction === LEFT) {
            npos = {"y": 100, "x": 190};
        }
        
        position = npos;        
        nextWhole = next(position, direction);
        
        block = map.block(nextWhole);        
                
        return {
            "new" : position,
            "old" : oldPosition
        };
    };

    function isMidSquare(x) { 
        var rem = x % 10;
        return rem > 3 || rem < 7;
    };

    function getDirectionAngle(dir) {
        switch (dir) {
        case RIGHT:
            return 0;
        case DOWN:
            return Math.PI / 2;
        case LEFT:
            return Math.PI;
        case UP:
            return -Math.PI / 2;
        default:
            return 0;
        }
    };

    // Render the player character as a robot while keeping the original collision footprint.
    function renderRobot(ctx, opts) {
        opts = opts || {};

        var x = opts.x,
            y = opts.y,
            s = opts.size,
            angle = typeof opts.angle === "number" ? opts.angle : 0,
            mouthPhase = typeof opts.mouthPhase === "number" ? opts.mouthPhase : 0,
            scale = typeof opts.scale === "number" ? opts.scale : 1,
            alpha = typeof opts.alpha === "number" ? opts.alpha : 1,
            glitch = typeof opts.glitch === "number" ? opts.glitch : 0,
            bodyRadius = s * 0.36,
            faceWidth = bodyRadius * 1.35,
            faceHeight = bodyRadius * 0.9,
            eyeWidth = faceWidth * 0.2,
            eyeHeight = faceHeight * 0.38,
            pupilWidth = eyeWidth * 0.38,
            pupilHeight = eyeHeight * 0.45,
            mouthWidth = faceWidth * 0.45,
            mouthHeight = (faceHeight * 0.12) + mouthPhase * (faceHeight * 0.22),
            mouthYOffset = faceHeight * 0.22,
            baseWidth = bodyRadius * 1.15,
            baseHeight = s * 0.12,
            antennaHeight = bodyRadius + faceHeight * 0.25,
            grillSpacing = mouthWidth / 4,
            glitchIntensity = Math.max(0, Math.min(1, glitch)),
            i;

        ctx.save();
        ctx.translate(x, y);
        if (scale !== 1) {
            ctx.scale(scale, scale);
        }
        ctx.rotate(angle);
        if (alpha !== 1) {
            ctx.globalAlpha = alpha;
        }

        ctx.beginPath();
        ctx.rect(-s / 2, -s / 2, s, s);
        ctx.clip();

        ctx.beginPath();
        ctx.fillStyle = "#9ea7b8";
        ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.lineWidth = s * 0.05;
        ctx.strokeStyle = "#5d6575";
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = "#cfd6e3";
        ctx.arc(-bodyRadius * 0.3, -bodyRadius * 0.35, bodyRadius * 0.3, Math.PI * 1.1, Math.PI * 1.8, false);
        ctx.fill();

        ctx.fillStyle = "#0f1424";
        ctx.fillRect(-faceWidth / 2, -faceHeight / 2, faceWidth, faceHeight);

        ctx.strokeStyle = "#2f3545";
        ctx.lineWidth = s * 0.03;
        ctx.beginPath();
        ctx.moveTo(-faceWidth / 2, -faceHeight / 2);
        ctx.lineTo(faceWidth / 2, -faceHeight / 2);
        ctx.stroke();

        ctx.fillStyle = "#63f6ff";
        ctx.fillRect(-faceWidth * 0.25 - eyeWidth / 2, -eyeHeight / 2, eyeWidth, eyeHeight);
        ctx.fillRect(faceWidth * 0.25 - eyeWidth / 2, -eyeHeight / 2, eyeWidth, eyeHeight);

        ctx.fillStyle = "#d1fbff";
        ctx.fillRect(-faceWidth * 0.25 - pupilWidth / 2, -pupilHeight / 2, pupilWidth, pupilHeight);
        ctx.fillRect(faceWidth * 0.25 - pupilWidth / 2, -pupilHeight / 2, pupilWidth, pupilHeight);

        ctx.fillStyle = mouthPhase > 0.6 ? "#ff7373" : "#ff4f4f";
        ctx.fillRect(-mouthWidth / 2, mouthYOffset, mouthWidth, mouthHeight);

        ctx.fillStyle = "#252c3d";
        for (i = -1.5; i <= 1.5; i += 1) {
            ctx.fillRect((i * grillSpacing) - (s * 0.01), mouthYOffset, s * 0.02, mouthHeight);
        }

        ctx.strokeStyle = "#5d6575";
        ctx.lineWidth = s * 0.04;
        ctx.beginPath();
        ctx.moveTo(0, -bodyRadius);
        ctx.lineTo(0, -antennaHeight);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = mouthPhase > 0.5 ? "#ffe066" : "#ffd23f";
        ctx.arc(0, -antennaHeight, s * 0.045, 0, Math.PI * 2, false);
        ctx.fill();

        ctx.fillStyle = "#4d5468";
        ctx.fillRect(-baseWidth / 2, bodyRadius * 0.65, baseWidth, baseHeight);

        ctx.strokeStyle = "#2f3545";
        ctx.lineWidth = s * 0.025;
        ctx.beginPath();
        ctx.moveTo(-baseWidth / 2, bodyRadius * 0.65);
        ctx.lineTo(baseWidth / 2, bodyRadius * 0.65);
        ctx.stroke();

        if (glitchIntensity > 0) {
            ctx.strokeStyle = "rgba(255, 90, 90, " + glitchIntensity + ")";
            ctx.lineWidth = s * 0.025;
            ctx.beginPath();
            ctx.moveTo(-faceWidth * 0.45, -faceHeight * 0.05);
            ctx.lineTo(faceWidth * 0.45, -faceHeight * 0.02);
            ctx.moveTo(-faceWidth * 0.35, faceHeight * 0.18);
            ctx.lineTo(faceWidth * 0.35, faceHeight * 0.22);
            ctx.stroke();
        }

        ctx.restore();
    };

    function drawDead(ctx, amount) { 

        var size = map.blockSize,
            half = size / 2,
            centerX = ((position.x / 10) * size) + half,
            centerY = ((position.y / 10) * size) + half,
            fade = Math.max(0, 1 - amount),
            scale = Math.max(0.2, 1 - amount * 0.8),
            facing = direction === NONE ? lastDirection : direction;

        if (amount >= 1) { 
            return;
        }

        renderRobot(ctx, {
            "x": centerX,
            "y": centerY,
            "size": size,
            "angle": getDirectionAngle(facing),
            "mouthPhase": 0,
            "alpha": fade,
            "scale": scale,
            "glitch": amount
        });

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.strokeStyle = "rgba(255, 214, 76, " + fade + ")";
        ctx.lineWidth = size * 0.04;
        ctx.beginPath();
        ctx.arc(0, 0, (size * 0.45) * (1 + amount * 1.4), 0, Math.PI * 2, false);
        ctx.stroke();
        ctx.restore();
    };

    function draw(ctx) { 

        var s = map.blockSize,
            half = s / 2,
            centerX = ((position.x / 10) * s) + half,
            centerY = ((position.y / 10) * s) + half,
            facing = direction === NONE ? lastDirection : direction,
            tick = typeof game.getTick === "function" ? game.getTick() : 0,
            pulse = (Math.sin(tick / 6) + 1) / 2;

        renderRobot(ctx, {
            "x": centerX,
            "y": centerY,
            "size": s,
            "angle": getDirectionAngle(facing),
            "mouthPhase": pulse * 0.9
        });
    };
    
    initUser();

    return {
        "draw"          : draw,
        "drawDead"      : drawDead,
        "loseLife"      : loseLife,
        "getLives"      : getLives,
        "score"         : score,
        "addScore"      : addScore,
        "theScore"      : theScore,
        "keyDown"       : keyDown,
        "move"          : move,
        "newLevel"      : newLevel,
        "reset"         : reset,
        "resetPosition" : resetPosition,
        "gainLife"      : gainLife,
        "setInitialLives" : setInitialLives
    };
};

Pacman.Map = function (size) {
    
    var height    = null, 
        width     = null, 
        blockSize = size,
        pillSize  = 0,
        map       = null;
    
    function withinBounds(y, x) {
        return y >= 0 && y < height && x >= 0 && x < width;
    }
    
    function isWall(pos) {
        return withinBounds(pos.y, pos.x) && map[pos.y][pos.x] === Pacman.WALL;
    }
    
    function isFloorSpace(pos) {
        if (!withinBounds(pos.y, pos.x)) {
            return false;
        }
        var peice = map[pos.y][pos.x];
        return peice === Pacman.EMPTY || 
            peice === Pacman.BISCUIT ||
            peice === Pacman.PILL;
    }
    
    function drawWall(ctx) {

        var i, j, p, line;
        
        ctx.strokeStyle = "#0000FF";
        ctx.lineWidth   = 5;
        ctx.lineCap     = "round";
        
        for (i = 0; i < Pacman.WALLS.length; i += 1) {
            line = Pacman.WALLS[i];
            ctx.beginPath();

            for (j = 0; j < line.length; j += 1) {

                p = line[j];
                
                if (p.move) {
                    ctx.moveTo(p.move[0] * blockSize, p.move[1] * blockSize);
                } else if (p.line) {
                    ctx.lineTo(p.line[0] * blockSize, p.line[1] * blockSize);
                } else if (p.curve) {
                    ctx.quadraticCurveTo(p.curve[0] * blockSize, 
                                         p.curve[1] * blockSize,
                                         p.curve[2] * blockSize, 
                                         p.curve[3] * blockSize);   
                }
            }
            ctx.stroke();
        }
    }
    
    function reset() {       
        map    = Pacman.clone(Pacman.MAP);
        height = map.length;
        width  = map[0].length;
        sanitize();
    };

    function block(pos) {
        return map[pos.y][pos.x];
    };
    
    function setBlock(pos, type) {
        map[pos.y][pos.x] = type;
    };

    function drawPills() { 
        return;
    };
    
    function draw(ctx) {
        
        var i, j, size = blockSize;

        ctx.fillStyle = "#000";
	    ctx.fillRect(0, 0, width * size, height * size);

        drawWall(ctx);
        
        for (i = 0; i < height; i += 1) {
		    for (j = 0; j < width; j += 1) {
			    drawBlock(i, j, ctx);
		    }
	    }
    };
    
    function drawBlock(y, x, ctx) {

        var layout = map[y][x];

        ctx.beginPath();
        
        if (layout === Pacman.EMPTY || layout === Pacman.BLOCK || 
            layout === Pacman.BISCUIT || layout === Pacman.PILL) {
            
            ctx.fillStyle = "#000";
		    ctx.fillRect((x * blockSize), (y * blockSize), 
                         blockSize, blockSize);
        }
        ctx.closePath();	 
    };

    function sanitize() {
        var i, j;
        for (i = 0; i < height; i += 1) {
            for (j = 0; j < width; j += 1) {
                if (map[i][j] === Pacman.BISCUIT || map[i][j] === Pacman.PILL) {
                    map[i][j] = Pacman.EMPTY;
                }
            }
        }
    }

    reset();
    
    return {
        "draw"         : draw,
        "drawBlock"    : drawBlock,
        "drawPills"    : drawPills,
        "block"        : block,
        "setBlock"     : setBlock,
        "reset"        : reset,
        "isWallSpace"  : isWall,
        "isFloorSpace" : isFloorSpace,
        "height"       : height,
        "width"        : width,
        "blockSize"    : blockSize
    };
};

Pacman.Audio = function(game) {
    
    var files          = [], 
        endEvents      = [],
        progressEvents = [],
        errorEvents    = [],
        playing        = [];
    
    function load(name, path, cb) { 

        var f      = files[name] = document.createElement("audio"),
            called = false;

        function finish() {
            if (called) {
                return;
            }
            called = true;
            if (typeof cb === "function") {
                cb();
            }
        }

        progressEvents[name] = function(event) { progress(event, name, finish); };
        errorEvents[name]    = function() { failed(name, finish); };
        
        f.addEventListener("canplaythrough", progressEvents[name], true);
        f.addEventListener("error", errorEvents[name], true);
        f.setAttribute("preload", "true");
        f.setAttribute("autobuffer", "true");
        f.setAttribute("src", path);
        f.pause();        
    };

    function removeListeners(name) {
        if (progressEvents[name]) {
            files[name].removeEventListener("canplaythrough", progressEvents[name], true);
            delete progressEvents[name];
        }
        if (errorEvents[name]) {
            files[name].removeEventListener("error", errorEvents[name], true);
            delete errorEvents[name];
        }
    }

    function progress(event, name, done) { 
        removeListeners(name);
        done();
    };

    function failed(name, done) {
        removeListeners(name);
        done();
    }

    function disableSound() {
        for (var i = 0; i < playing.length; i++) {
            files[playing[i]].pause();
            files[playing[i]].currentTime = 0;
        }
        playing = [];
    };

    function ended(name) { 

        var i, tmp = [], found = false;

        files[name].removeEventListener("ended", endEvents[name], true);

        for (i = 0; i < playing.length; i++) {
            if (!found && playing[i]) { 
                found = true;
            } else { 
                tmp.push(playing[i]);
            }
        }
        playing = tmp;
    };

    function play(name) { 
        if (game.soundDisabled()) {
            return;
        }
        var sound = files[name];
        if (!sound) {
            return;
        }
        endEvents[name] = function() { ended(name); };
        playing.push(name);
        sound.addEventListener("ended", endEvents[name], true);
        try {
            if (sound.currentTime !== undefined) {
                sound.currentTime = 0;
            }
        } catch (ignore) {
            try {
                sound.pause();
                sound.currentTime = 0;
            } catch (ignore2) {
                // noop
            }
        }
        sound.play();
    };

    function pause() { 
        for (var i = 0; i < playing.length; i++) {
            files[playing[i]].pause();
        }
    };
    
    function resume() { 
        for (var i = 0; i < playing.length; i++) {
            files[playing[i]].play();
        }        
    };
    
    return {
        "disableSound" : disableSound,
        "load"         : load,
        "play"         : play,
        "pause"        : pause,
        "resume"       : resume
    };
};

function loadImage(src) {
    return new Promise(function (resolve, reject) {
        if (!src) {
            resolve(null);
            return;
        }
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error("Falha ao carregar imagem: " + src)); };
        img.src = src;
    });
}

var AnswerSpriteCache = (function () {
    var cache = {};
    return {
        "get" : function (src) {
            if (!src) {
                return Promise.resolve(null);
            }
            if (!cache[src]) {
                cache[src] = loadImage(src)["catch"](function () { return null; });
            }
            return cache[src];
        }
    };
}());

function shuffle(array) {
    var copy = array.slice(0), currentIndex = copy.length, randomIndex, tmp;
    while (currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        tmp = copy[currentIndex];
        copy[currentIndex] = copy[randomIndex];
        copy[randomIndex] = tmp;
    }
    return copy;
}

function QuestionManager(phases, settings) {
    var phaseIndex = 0,
        questionIndex = 0,
        order = settings.questionOrder || "sequential",
        phaseOrder = settings.phaseOrder || "sequential",
        sequence = [],
        phaseSequence = [];

    function resetSequences() {
        phaseSequence = phases.map(function (phase, idx) { return idx; });
        if (phaseOrder === "random") {
            phaseSequence = shuffle(phaseSequence);
        }
    }

    function resetQuestionsForPhase() {
        var currentPhase = phases[phaseSequence[phaseIndex]];
        sequence = currentPhase.questions.map(function (_, idx) { return idx; });
        if (order === "random") {
            sequence = shuffle(sequence);
        }
        questionIndex = 0;
    }

    function currentPhaseObject() {
        return phases[phaseSequence[phaseIndex]];
    }

    resetSequences();
    resetQuestionsForPhase();

    return {
        "currentPhase" : function () {
            return currentPhaseObject();
        },
        "currentQuestion" : function () {
            var phase = currentPhaseObject();
            return phase.questions[sequence[questionIndex]];
        },
        "nextQuestion" : function () {
            questionIndex += 1;
            if (questionIndex >= sequence.length) {
                phaseIndex += 1;
                if (phaseIndex >= phaseSequence.length) {
                    resetSequences();
                    phaseIndex = 0;
                }
                resetQuestionsForPhase();
                return {
                    "phaseChanged" : true,
                    "question"     : this.currentQuestion()
                };
            }
            return {
                "phaseChanged" : false,
                "question"     : this.currentQuestion()
            };
        },
        "reset" : function () {
            phaseIndex = 0;
            resetSequences();
            resetQuestionsForPhase();
        },
        "phaseCount" : function () {
            return phases.length;
        }
    };
}

function AnswerManager(map, settings) {
    var items = [],
        currentQuestion = null,
        blockSize = map.blockSize,
        configuredSlots = normalizeConfiguredSlots(settings.answerSlots || []),
        playerStart = playerStartTile(),
        reachableSlots = computeReachableSlots(),
        fallbackSlotsRaw = reachableSlots.length ? reachableSlots.slice() : collectAllFloorSlots(),
        reachableLookup = buildLookup((reachableSlots.length ? reachableSlots : fallbackSlotsRaw).filter(slotIsAllowed)),
        fallbackSlots = fallbackSlotsRaw.filter(slotIsAllowed),
        activePromises = [];

    function normalizeConfiguredSlots(slots) {
        return (slots || []).map(function (slot) {
            return {
                "x": Math.round(slot.x),
                "y": Math.round(slot.y)
            };
        });
    }

    function buildLookup(list) {
        var lookup = {}, i;
        for (i = 0; i < list.length; i += 1) {
            lookup[tileKey(list[i])] = true;
        }
        return lookup;
    }

    function tileKey(slot) {
        return slot.x + ":" + slot.y;
    }

    function inBounds(slot) {
        return slot.x >= 0 && slot.x < map.width && slot.y >= 0 && slot.y < map.height;
    }

    function slotClone(slot) {
        return {"x": slot.x, "y": slot.y};
    }

    function slotIsFloor(slot) {
        return inBounds(slot) && map.isFloorSpace({"x": slot.x, "y": slot.y});
    }

    function slotIsReachable(slot) {
        return !!reachableLookup[tileKey(slot)];
    }

    function slotIsValid(slot) {
        return slotIsFloor(slot) && slotIsReachable(slot) && slotIsAllowed(slot);
    }

    function isPlayerStart(slot) {
        return slot.x === playerStart.x && slot.y === playerStart.y;
    }

    function slotIsAllowed(slot) {
        return !isPlayerStart(slot);
    }

    function playerStartTile() {
        var start = settings.playerStart;
        if (start && typeof start.x === "number" && typeof start.y === "number") {
            return {
                "x": Math.round(start.x),
                "y": Math.round(start.y)
            };
        }
        return {"x": 9, "y": 12};
    }

    function collectAllFloorSlots() {
        var y, x, slots = [];
        for (y = 0; y < map.height; y += 1) {
            for (x = 0; x < map.width; x += 1) {
                if (slotIsFloor({"x": x, "y": y}) && slotIsAllowed({"x": x, "y": y})) {
                    slots.push({"x": x, "y": y});
                }
            }
        }
        return slots;
    }

    function computeReachableSlots() {
        var queue = [],
            visited = {},
            results = [],
            dirs = [[1,0],[-1,0],[0,1],[0,-1]],
            current, i, nextSlot, key;

        if (!slotIsFloor(playerStart)) {
            return [];
        }

        queue.push(slotClone(playerStart));
        visited[tileKey(playerStart)] = true;
        results.push(slotClone(playerStart));

        while (queue.length) {
            current = queue.shift();
            for (i = 0; i < dirs.length; i += 1) {
                nextSlot = {
                    "x": current.x + dirs[i][0],
                    "y": current.y + dirs[i][1]
                };
                if (!slotIsFloor(nextSlot)) {
                    continue;
                }
                key = tileKey(nextSlot);
                if (visited[key]) {
                    continue;
                }
                visited[key] = true;
                queue.push(slotClone(nextSlot));
                results.push(slotClone(nextSlot));
            }
        }

        return results;
    }

    function toCoord(slot) {
        return {
            "x": slot.x * 10,
            "y": slot.y * 10
        };
    }

    function selectSlots(count) {
        var selected = [],
            used = {},
            pools = [
                shuffle(configuredSlots.filter(slotIsValid)),
                shuffle(reachableSlots.filter(slotIsValid)),
                shuffle(fallbackSlots)
            ],
            i, j, pool, slot, key;

        function pushSlot(candidate) {
            key = tileKey(candidate);
            if (used[key]) {
                return false;
            }
            used[key] = true;
            selected.push(slotClone(candidate));
            return true;
        }

        for (i = 0; i < pools.length && selected.length < count; i += 1) {
            pool = pools[i];
            for (j = 0; j < pool.length && selected.length < count; j += 1) {
                slot = pool[j];
                if (slotIsValid(slot)) {
                    pushSlot(slot);
                }
            }
        }

        if (selected.length < count) {
            throw new Error("Não foi possível encontrar espaços válidos suficientes para posicionar as respostas.");
        }

        return selected;
    }

    function buildItem(answer, slot) {
        var coord = toCoord(slot),
            scale = (settings.answerScale && settings.answerScale > 0) ? settings.answerScale : 1,
            renderSize = blockSize * 0.8 * scale,
            radius = 10 * Math.max(0.6, scale),
            spritePromise = AnswerSpriteCache.get(answer.image);

        var item = {
            "answer"   : answer,
            "grid"     : coord,
            "radius"   : radius,
            "renderSize" : renderSize,
            "scale"      : scale,
            "sprite"   : null,
            "active"   : true,
            "draw"     : function (ctx, tick) {
                if (!this.active) {
                    return;
                }
                var px = (this.grid.x / 10) * blockSize,
                    py = (this.grid.y / 10) * blockSize,
                    bounce = Math.sin((tick / 6)) * (blockSize * 0.05);

                ctx.save();
                ctx.translate(px + blockSize / 2, py + blockSize / 2 + bounce);

                if (this.sprite) {
                    ctx.drawImage(this.sprite, -this.renderSize / 2, -this.renderSize / 2, this.renderSize, this.renderSize);
                } else {
                    ctx.fillStyle = this.answer.correct ? "#00E676" : "#FF7043";
                    ctx.beginPath();
                    ctx.arc(0, 0, this.renderSize / 2, 0, Math.PI * 2, false);
                    ctx.fill();
                }
                ctx.restore();
            },
            "collides" : function (pos) {
                var dx = pos.x - this.grid.x,
                    dy = pos.y - this.grid.y;
                return Math.sqrt((dx * dx) + (dy * dy)) <= this.radius;
            }
        };

        activePromises.push(spritePromise.then(function (img) {
            item.sprite = img;
        })["catch"](function () {
            item.sprite = null;
        }));

        return item;
    }

    return {
        "setQuestion" : function (question) {
            var slots = selectSlots(question.answers.length),
                answers = shuffle(question.answers),
                i;

            items = [];
            currentQuestion = question;
            activePromises = [];

            if (!slots.length) {
                throw new Error("Nenhum espaço acessível disponível para posicionar respostas.");
            }

            for (i = 0; i < answers.length && i < slots.length; i += 1) {
                items.push(buildItem(answers[i], slots[i]));
            }
        },
        "clear" : function () {
            items = [];
            currentQuestion = null;
            activePromises = [];
        },
        "items" : function () {
            return items;
        },
        "consume" : function (item) {
            item.active = false;
            items = items.filter(function (it) { return it.active; });
        },
        "draw" : function (ctx, tick) {
            var i;
            for (i = 0; i < items.length; i += 1) {
                items[i].draw(ctx, tick);
            }
        },
        "checkCollision" : function (pos) {
            var i;
            for (i = 0; i < items.length; i += 1) {
                if (items[i].active && items[i].collides(pos)) {
                    return items[i];
                }
            }
            return null;
        },
        "awaitAssets" : function () {
            return Promise.all(activePromises);
        },
        "question" : function () {
            return currentQuestion;
        }
    };
}

function normalizeSettings(raw) {
    var cfg = Pacman.clone(raw || {});
    cfg.initialLives = (typeof cfg.initialLives === "number" && cfg.initialLives > 0) ? cfg.initialLives : 3;
    cfg.maxLives = (typeof cfg.maxLives === "number" && cfg.maxLives >= cfg.initialLives) ? cfg.maxLives : Math.max(cfg.initialLives, 5);
    cfg.lifeRewardOnCorrect = (typeof cfg.lifeRewardOnCorrect === "number") ? cfg.lifeRewardOnCorrect : 1;
    cfg.lifePenaltyWrong = (typeof cfg.lifePenaltyWrong === "number") ? cfg.lifePenaltyWrong : 1;
    cfg.lifePenaltyGhost = (typeof cfg.lifePenaltyGhost === "number") ? cfg.lifePenaltyGhost : 1;
    cfg.powerDurationSeconds = (typeof cfg.powerDurationSeconds === "number") ? cfg.powerDurationSeconds : 8;
    cfg.transitionDelaySeconds = (typeof cfg.transitionDelaySeconds === "number") ? cfg.transitionDelaySeconds : 2;
    cfg.answerScale = (typeof cfg.answerScale === "number" && cfg.answerScale > 0) ? cfg.answerScale : 1;
    cfg.ghostSpeedModifier = (typeof cfg.ghostSpeedModifier === "number") ? cfg.ghostSpeedModifier : 1;
    cfg.questionOrder = cfg.questionOrder || "sequential";
    cfg.phaseOrder = cfg.phaseOrder || "sequential";
    cfg.answerSlots = cfg.answerSlots || [];
    cfg.audioRoot = cfg.audioRoot || "assets/audio/";

    function normalizeGhostAI(rawAI) {
        var ai = Pacman.clone(rawAI || {}),
            validModes = {"random": true, "chase": true, "hybrid": true};

        ai.mode = validModes[ai.mode] ? ai.mode : "chase";

        var interval = parseInt(ai.pathRefreshInterval, 10);
        ai.pathRefreshInterval = (isFinite(interval) && interval > 0) ? interval : 6;

        var deviation = Number(ai.randomDeviation);
        if (!isFinite(deviation) || deviation < 0) {
            deviation = 0;
        }
        ai.randomDeviation = Math.min(1, deviation);

        var fleeMultiplier = Number(ai.fleeMultiplier);
        ai.fleeMultiplier = (isFinite(fleeMultiplier) && fleeMultiplier > 0) ? fleeMultiplier : 1.5;

        ai.useHomeTile = ai.useHomeTile !== false;

        return ai;
    }

    cfg.ghostAI = normalizeGhostAI(cfg.ghostAI);
    return cfg;
}

function fetchJSON(path) {
    return fetch(path, {"cache":"no-store"})["then"](function (response) {
        if (!response.ok) {
            throw new Error("Não foi possível carregar " + path + " (" + response.status + ")");
        }
        return response.json();
    });
}

var PACMAN = (function () {

    var state        = WAITING,
        audio        = null,
        ghosts       = [],
        ghostSpecs   = ["#ff6f91", "#845ef7", "#3ddbab", "#ffd166"],
        eatenCount   = 0,
        tick         = 0,
        ghostPos, userPos, 
        stateChanged = true,
        timerStart   = null,
        lastTime     = 0,
        ctx          = null,
        timer        = null,
        map          = null,
        user         = null,
        stored       = null,
        settings     = null,
        questionManager = null,
        answerManager   = null,
        stats           = null,
        hud             = null,
        powerState      = {"active":false,"expires":0,"duration":0},
        pendingQuestion = null,
        phaseNumber     = 1,
        currentPhase    = null,
        currentQuestion = null,
        ghostAIConfig   = null,
        ghostDistanceField = null,
        ghostDistanceFieldTick = -1,
        ghostDistanceTarget = null,
        homeDistanceField = null,
        homeDistanceFieldTick = -1,
        homeTile = {"x": 9, "y": 8},
        currentUserTile = {"x": 9, "y": 12},
        TELEPORT_ROW = 10;

    function getTick() { 
        return tick;
    };

    function initHud() {
        hud = {
            "question" : document.getElementById("question-text"),
            "life"     : document.getElementById("life-counter"),
            "score"    : document.getElementById("score-counter"),
            "streak"   : document.getElementById("streak-counter"),
            "phase"    : document.getElementById("phase-counter"),
            "feedback" : document.getElementById("feedback-text"),
            "power"    : document.getElementById("power-timer")
        };
    }

    function updateHudStats() {
        if (!hud || !stats) {
            return;
        }
        hud.life.textContent = "Vidas: " + stats.lives;
        hud.score.textContent = "Acertos: " + stats.correct;
        hud.streak.textContent = "Sequência: " + stats.streak;
        hud.phase.textContent = "Fase " + phaseNumber + "/" + questionManager.phaseCount();
    }

    function setQuestionText(text) {
        if (hud) {
            hud.question.textContent = text;
        }
    }

    function setFeedback(message, state) {
        if (!hud) {
            return;
        }
        hud.feedback.textContent = message || "";
        if (state) {
            hud.feedback.setAttribute("data-state", state);
        } else {
            hud.feedback.removeAttribute("data-state");
        }
    }

    function updatePowerHud(remainingSeconds) {
        if (!hud) {
            return;
        }
        if (remainingSeconds > 0) {
            hud.power.textContent = "Poder: " + remainingSeconds.toFixed(1) + "s";
        } else {
            hud.power.textContent = "";
        }
    }

    function coordToTile(pos) {
        return {
            "x": Math.round(pos.x / 10),
            "y": Math.round(pos.y / 10)
        };
    }

    function tilesEqual(a, b) {
        return !!a && !!b && a.x === b.x && a.y === b.y;
    }

    function buildDistanceField(target) {
        if (!map || !target) {
            return null;
        }

        var width = map.width,
            height = map.height,
            y, x;

        if (typeof width !== "number" || typeof height !== "number") {
            return null;
        }

        if (target.x < 0 || target.x >= width || target.y < 0 || target.y >= height) {
            return null;
        }

        if (!map.isFloorSpace({"x": target.x, "y": target.y})) {
            return null;
        }

        var distances = new Array(height),
            visited = new Array(height),
            queue = [],
            head = 0,
            dirs = [[1,0],[-1,0],[0,1],[0,-1]];

        for (y = 0; y < height; y += 1) {
            distances[y] = new Array(width);
            visited[y] = new Array(width);
            for (x = 0; x < width; x += 1) {
                distances[y][x] = Infinity;
                visited[y][x] = false;
            }
        }

        function enqueue(tx, ty, dist) {
            if (tx < 0 || tx >= width || ty < 0 || ty >= height) {
                return;
            }
            if (visited[ty][tx]) {
                return;
            }
            if (!map.isFloorSpace({"x": tx, "y": ty})) {
                return;
            }
            visited[ty][tx] = true;
            distances[ty][tx] = dist;
            queue.push({"x": tx, "y": ty});
        }

        enqueue(target.x, target.y, 0);

        while (head < queue.length) {
            var current = queue[head++],
                baseDist = distances[current.y][current.x],
                idx;

            for (idx = 0; idx < dirs.length; idx += 1) {
                var dir = dirs[idx],
                    nx = current.x + dir[0],
                    ny = current.y + dir[1];

                if (ny === TELEPORT_ROW) {
                    if (nx < 0) {
                        nx = width - 1;
                    } else if (nx >= width) {
                        nx = 0;
                    }
                }

                enqueue(nx, ny, baseDist + 1);
            }
        }

        return distances;
    }

    function findNearestFloorTile(origin) {
        if (!map || !origin) {
            return null;
        }
        var width = map.width,
            height = map.height,
            queue = [],
            head = 0,
            visited = new Array(height),
            dirs = [[1,0],[-1,0],[0,1],[0,-1]],
            y, x;

        for (y = 0; y < height; y += 1) {
            visited[y] = new Array(width);
            for (x = 0; x < width; x += 1) {
                visited[y][x] = false;
            }
        }

        function enqueue(tx, ty) {
            if (tx < 0 || tx >= width || ty < 0 || ty >= height) {
                return;
            }
            if (visited[ty][tx]) {
                return;
            }
            visited[ty][tx] = true;
            queue.push({"x": tx, "y": ty});
        }

        enqueue(origin.x, origin.y);

        while (head < queue.length) {
            var current = queue[head++],
                idx, nx, ny;

            if (map.isFloorSpace({"x": current.x, "y": current.y})) {
                return current;
            }

            for (idx = 0; idx < dirs.length; idx += 1) {
                nx = current.x + dirs[idx][0];
                ny = current.y + dirs[idx][1];

                if (ny === TELEPORT_ROW) {
                    if (nx < 0) {
                        nx = width - 1;
                    } else if (nx >= width) {
                        nx = 0;
                    }
                }

                enqueue(nx, ny);
            }
        }

        return null;
    }

    var DIRECTION_VECTORS = {};
    DIRECTION_VECTORS[LEFT] = {"x": -1, "y": 0};
    DIRECTION_VECTORS[RIGHT] = {"x": 1, "y": 0};
    DIRECTION_VECTORS[UP] = {"x": 0, "y": -1};
    DIRECTION_VECTORS[DOWN] = {"x": 0, "y": 1};

    function stepTile(tile, direction) {
        var delta = DIRECTION_VECTORS[direction];
        if (!delta) {
            return null;
        }
        var width = map.width,
            height = map.height,
            nx = tile.x + delta.x,
            ny = tile.y + delta.y;

        if (ny === TELEPORT_ROW) {
            if (nx < 0) {
                nx = width - 1;
            } else if (nx >= width) {
                nx = 0;
            }
        }

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            return null;
        }
        if (!map.isFloorSpace({"x": nx, "y": ny})) {
            return null;
        }
        return {"x": nx, "y": ny};
    }

    function getDistanceValue(field, tile) {
        if (!field || !tile) {
            return Infinity;
        }
        if (!field[tile.y]) {
            return Infinity;
        }
        var value = field[tile.y][tile.x];
        return (typeof value === "number") ? value : Infinity;
    }

    function ensureHomeDistanceField() {
        if (!ghostAIConfig || !ghostAIConfig.useHomeTile) {
            homeDistanceField = null;
            return;
        }
        if (!map) {
            homeDistanceField = null;
            return;
        }
        if (!homeDistanceField) {
            var target = homeTile;
            if (!map.isFloorSpace(target)) {
                var fallback = findNearestFloorTile(target);
                if (fallback) {
                    homeTile = fallback;
                    target = fallback;
                } else {
                    homeDistanceField = null;
                    return;
                }
            }
            homeDistanceField = buildDistanceField(target);
            homeDistanceFieldTick = tick;
        }
    }

    function ensureGhostDistanceField(targetTile) {
        if (!ghostAIConfig || ghostAIConfig.mode === "random") {
            ghostDistanceField = null;
            ghostDistanceTarget = null;
            return;
        }
        if (!map || !targetTile) {
            return;
        }
        var interval = Math.max(1, ghostAIConfig.pathRefreshInterval || 1),
            needsRebuild = !ghostDistanceField || !ghostDistanceTarget || !tilesEqual(ghostDistanceTarget, targetTile) ||
                (tick - ghostDistanceFieldTick) >= interval;

        if (needsRebuild) {
            var field = buildDistanceField(targetTile);
            if (field) {
                ghostDistanceField = field;
                ghostDistanceFieldTick = tick;
                ghostDistanceTarget = {"x": targetTile.x, "y": targetTile.y};
            }
        }
        ensureHomeDistanceField();
    }

    function getGhostAIDirection(context) {
        if (!ghostAIConfig || ghostAIConfig.mode === "random") {
            return null;
        }

        if (ghostAIConfig.mode === "hybrid" && Math.random() < 0.35) {
            return null;
        }

        if (!map) {
            return null;
        }

        var tile = coordToTile(context.position),
            blocked = context.blocked || [],
            blockedLookup = {},
            directionList = [UP, LEFT, DOWN, RIGHT],
            candidates = [],
            field = null,
            chase = !context.isVulnerable && !context.isEaten;

        blocked.forEach(function (dir) {
            blockedLookup[dir] = true;
        });

        if (context.isEaten && ghostAIConfig.useHomeTile) {
            ensureHomeDistanceField();
            field = homeDistanceField;
        } else {
            field = ghostDistanceField;
        }

        if (!field) {
            return null;
        }

        var currentValue = getDistanceValue(field, tile);
        if (!isFinite(currentValue)) {
            return null;
        }

        for (var i = 0; i < directionList.length; i += 1) {
            var dir = directionList[i];
            if (blockedLookup[dir]) {
                continue;
            }
            var nextTile = stepTile(tile, dir);
            if (!nextTile) {
                continue;
            }
            var value = getDistanceValue(field, nextTile);
            if (!isFinite(value)) {
                continue;
            }
            candidates.push({
                "direction": dir,
                "value": value,
                "straight": dir === context.direction
            });
        }

        if (!candidates.length) {
            return null;
        }

        candidates.sort(function (a, b) {
            var av = a.value;
            var bv = b.value;
            if (!chase) {
                // fleeing: prefer higher distance
                av = -av;
                bv = -bv;
            }
            if (av === bv) {
                if (a.straight && !b.straight) {
                    return -1;
                }
                if (!a.straight && b.straight) {
                    return 1;
                }
                return 0;
            }
            return av - bv;
        });

        if (ghostAIConfig.randomDeviation > 0 && candidates.length > 1 &&
            Math.random() < ghostAIConfig.randomDeviation) {
            return candidates[1].direction;
        }

        if (!chase && ghostAIConfig.fleeMultiplier > 0 && candidates.length > 1) {
            // amplify preference for higher distance
            var best = candidates[0],
                adjusted = [best];
            for (var j = 1; j < candidates.length; j += 1) {
                if (-candidates[j].value * ghostAIConfig.fleeMultiplier > -best.value) {
                    adjusted.push(candidates[j]);
                }
            }
            if (adjusted.length > 1) {
                return adjusted[Math.floor(Math.random() * adjusted.length)].direction;
            }
        }

        return candidates[0].direction;
    }
    function drawScore(text, position) {
        ctx.fillStyle = "#FFFFFF";
        ctx.font      = "12px BDCartoonShoutRegular";
        ctx.fillText(text, 
                     (position["new"]["x"] / 10) * map.blockSize, 
                     ((position["new"]["y"] + 5) / 10) * map.blockSize);
    }
    
    function dialog(text) {
        ctx.fillStyle = "#FFFF00";
        ctx.font      = "18px Calibri";
        var width = ctx.measureText(text).width,
            x     = ((map.width * map.blockSize) - width) / 2;        
        ctx.fillText(text, x, (map.height * 10) + 8);
    }

    function soundDisabled() {
        return localStorage["soundDisabled"] === "true";
    };

    function resetStats() {
        stats = {
            "lives"   : settings.initialLives,
            "correct" : 0,
            "streak"  : 0
        };
        phaseNumber = 1;
        powerState = {"active":false,"expires":0,"duration":0};
        updateHudStats();
        updatePowerHud(0);
    }

    function applyPhaseSettings(phase) {
        currentPhase = phase;
        var modifier = phase.ghostSpeedModifier;
        if (typeof modifier !== "number") {
            modifier = settings.ghostSpeedModifier || 1;
        }
        Pacman.ghostSpeedMultiplier = modifier;
    }

    function activatePower(durationSeconds) {
        var i, duration = durationSeconds || currentPhase.powerDuration || settings.powerDurationSeconds || 8;
        powerState.active = true;
        powerState.duration = duration;
        powerState.expires = tick + Math.round(duration * Pacman.FPS);
        eatenCount = 0;
        timerStart = tick;
        for (i = 0; i < ghosts.length; i += 1) {
            ghosts[i].makeEatable();
        }
    }

    function deactivatePower() {
        powerState.active = false;
        powerState.expires = 0;
        powerState.duration = 0;
        updatePowerHud(0);
    }
    
    function startLevel() {        
        user.resetPosition();
        for (var i = 0; i < ghosts.length; i += 1) { 
            ghosts[i].reset();
        }
        currentUserTile = {"x": 9, "y": 12};
        ghostDistanceField = null;
        ghostDistanceTarget = null;
        homeDistanceField = null;
        ensureGhostDistanceField(currentUserTile);
        audio.play("start");
        timerStart = tick;
        setState(COUNTDOWN);
    }    

    function startNewGame() {
        questionManager.reset();
        applyPhaseSettings(questionManager.currentPhase());
        resetStats();
        stateChanged = true;
        setState(WAITING);
        user.reset();
        currentUserTile = {"x": 9, "y": 12};
        ghostDistanceField = null;
        ghostDistanceTarget = null;
        stats.lives = user.getLives();
        updateHudStats();
        map.reset();
        map.draw(ctx);
        ensureGhostDistanceField(currentUserTile);
        pendingQuestion = {
            "question"     : questionManager.currentQuestion(),
            "phaseChanged" : false
        };
        setFeedback("Colete a opção correta para responder!", "neutral");
        prepareQuestion(pendingQuestion.question, {"phaseChanged": false});
    }

    function prepareQuestion(question, options) {
        var opts = options || {};
        currentQuestion = question;
        setQuestionText(question.prompt);
        if (!opts.phaseChanged) {
            if (!opts.feedbackFrozen) {
                setFeedback("", null);
            }
        }
        answerManager.setQuestion(question);
        answerManager.awaitAssets().then(function () {
            map.reset();
            map.draw(ctx);
            startLevel();
        })["catch"](function (err) {
            setFeedback(err.message || "Erro ao carregar recursos", "negative");
        });
    }

    function grantLife(amount) {
        var i;
        amount = amount || 0;
        for (i = 0; i < amount; i += 1) {
            if (typeof user.gainLife === "function") {
                user.gainLife(settings.maxLives);
            }
        }
        stats.lives = user.getLives();
        updateHudStats();
    }

    function applyLifePenalty(amount) {
        var i;
        for (i = 0; i < amount; i += 1) {
            user.loseLife();
        }
        stats.lives = user.getLives();
        updateHudStats();
        if (stats.lives <= 0) {
            gameOver();
            return true;
        }
        return false;
    }

    function gameOver() {
        setState(WAITING);
        setFeedback("Game Over! Pressione N para reiniciar.", "negative");
        updatePowerHud(0);
    }

    function restartAfterPenalty() {
        map.draw(ctx);
        startLevel();
    }

    function scheduleNextQuestion() {
        var result = questionManager.nextQuestion();
        pendingQuestion = {
            "question"     : result.question,
            "phaseChanged" : result.phaseChanged
        };
        timerStart = tick;
        setState(QUESTION_PAUSE);
        stateChanged = true;
    }

    function processPendingQuestion() {
        if (!pendingQuestion) {
            return;
        }
        if (pendingQuestion.phaseChanged) {
            phaseNumber += 1;
            if (phaseNumber > questionManager.phaseCount()) {
                phaseNumber = 1;
            }
            applyPhaseSettings(questionManager.currentPhase());
            updateHudStats();
            setFeedback("Nova fase: " + (currentPhase.title || currentPhase.id || phaseNumber), "neutral");
        }
        prepareQuestion(pendingQuestion.question, {
            "phaseChanged": pendingQuestion.phaseChanged,
            "feedbackFrozen": true
        });
        pendingQuestion = null;
    }

    function handleCorrectAnswer(item) {
        answerManager.consume(item);
        if (audio && typeof audio.play === "function") {
            audio.play("correct");
        }
        stats.correct += 1;
        stats.streak += 1;
        if (settings.lifeRewardOnCorrect > 0) {
            grantLife(settings.lifeRewardOnCorrect);
        } else {
            stats.lives = user.getLives();
            updateHudStats();
        }
        setFeedback(item.answer.feedback || "Correto! Excelente trabalho.", "positive");
        if (item.answer.correct && item.answer.grantsPower !== false) {
            activatePower(item.answer.powerDuration || currentPhase.powerDuration || settings.powerDurationSeconds);
        }
        scheduleNextQuestion();
    }

    function handleWrongAnswer(item) {
        answerManager.consume(item);
        if (audio && typeof audio.play === "function") {
            audio.play("wrong");
        }
        stats.streak = 0;
        if (applyLifePenalty(settings.lifePenaltyWrong || 1)) {
            return;
        }
        setFeedback(item.answer.feedback || "Resposta incorreta. Tente outra opção!", "negative");
        deactivatePower();
        restartAfterPenalty();
    }

    function handleAnswerCollision(item) {
        if (!item || !item.active) {
            return;
        }
        if (item.answer.correct) {
            handleCorrectAnswer(item);
        } else {
            handleWrongAnswer(item);
        }
    }

    function questionTransitionTicks() {
        var seconds = settings.transitionDelaySeconds;
        if (typeof seconds !== "number") {
            seconds = 2;
        }
        return Math.max(1, Math.round(seconds * Pacman.FPS));
    }

    function updatePowerState() {
        if (!powerState.active) {
            updatePowerHud(0);
            return;
        }
        var remaining = powerState.expires - tick;
        if (remaining <= 0) {
            deactivatePower();
            return;
        }
        updatePowerHud(remaining / Pacman.FPS);
    }


    function keyDown(e) {
        if (e.keyCode === KEY.N) {
            startNewGame();
        } else if (e.keyCode === KEY.S) {
            audio.disableSound();
            localStorage["soundDisabled"] = !soundDisabled();
        } else if (e.keyCode === KEY.P && state === PAUSE) {
            audio.resume();
            map.draw(ctx);
            setState(stored);
        } else if (e.keyCode === KEY.P) {
            stored = state;
            setState(PAUSE);
            audio.pause();
            map.draw(ctx);
            dialog("Paused");
        } else if (state !== PAUSE) {   
            return user.keyDown(e);
        }
        return true;
    }    

    function loseLife(reason) {        
        if (applyLifePenalty(settings.lifePenaltyGhost || 1)) {
            return;
        }
        stats.streak = 0;
        setFeedback(reason || "Um fantasma te pegou!", "negative");
        deactivatePower();
        restartAfterPenalty();
    }

    function setState(nState) { 
        state = nState;
        stateChanged = true;
    };
    
    function collided(user, ghost) {
        return (Math.sqrt(Math.pow(ghost.x - user.x, 2) + 
                          Math.pow(ghost.y - user.y, 2))) < 10;
    };

    function drawLifeIcon(x, y, size) {
        var bodyRadius = size * 0.42,
            faceWidth = bodyRadius * 1.2,
            faceHeight = bodyRadius * 0.82,
            eyeWidth = faceWidth * 0.22,
            eyeHeight = faceHeight * 0.42,
            pupilWidth = eyeWidth * 0.45,
            mouthWidth = faceWidth * 0.48,
            mouthHeight = faceHeight * 0.22,
            mouthY = faceHeight * 0.18,
            antennaHeight = bodyRadius + size * 0.28,
            antennaBall = size * 0.12;
        
        ctx.save();
        ctx.translate(x, y);

        ctx.beginPath();
        ctx.fillStyle = "#9ea7b8";
        ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.lineWidth = size * 0.08;
        ctx.strokeStyle = "#5d6575";
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = "#cfd6e3";
        ctx.arc(-bodyRadius * 0.35, -bodyRadius * 0.33, bodyRadius * 0.32, Math.PI * 1.1, Math.PI * 1.8, false);
        ctx.fill();

        ctx.fillStyle = "#0f1424";
        ctx.fillRect(-faceWidth / 2, -faceHeight / 2, faceWidth, faceHeight);

        ctx.fillStyle = "#63f6ff";
        ctx.fillRect(-faceWidth * 0.25 - eyeWidth / 2, -eyeHeight / 2, eyeWidth, eyeHeight);
        ctx.fillRect(faceWidth * 0.25 - eyeWidth / 2, -eyeHeight / 2, eyeWidth, eyeHeight);

        ctx.fillStyle = "#d1fbff";
        ctx.fillRect(-faceWidth * 0.25 - pupilWidth / 2, -pupilWidth / 2, pupilWidth, pupilWidth);
        ctx.fillRect(faceWidth * 0.25 - pupilWidth / 2, -pupilWidth / 2, pupilWidth, pupilWidth);

        ctx.fillStyle = "#ff585d";
        ctx.fillRect(-mouthWidth / 2, mouthY, mouthWidth, mouthHeight);

        ctx.strokeStyle = "#5d6575";
        ctx.lineWidth = size * 0.06;
        ctx.beginPath();
        ctx.moveTo(0, -bodyRadius);
        ctx.lineTo(0, -antennaHeight);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = "#ffd23f";
        ctx.arc(0, -antennaHeight, antennaBall, 0, Math.PI * 2, false);
        ctx.fill();

        ctx.fillStyle = "#4d5468";
        ctx.fillRect(-bodyRadius * 0.8, bodyRadius * 0.65, bodyRadius * 1.6, size * 0.16);

        ctx.restore();
    }

    function drawFooter() {
        
        var topLeft  = (map.height * map.blockSize),
            textBase = topLeft + 17;
        
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, topLeft, (map.width * map.blockSize), 30);
        
        ctx.fillStyle = "#FFFF00";

        for (var i = 0, len = user.getLives(); i < len; i++) {
        drawLifeIcon(150 + (25 * i) + map.blockSize / 2,
                     (topLeft + 1) + map.blockSize / 2,
                     map.blockSize * 0.6);
        }

        ctx.fillStyle = !soundDisabled() ? "#00FF00" : "#FF0000";
        ctx.font = "bold 16px sans-serif";
        //ctx.fillText("???", 10, textBase);
        ctx.fillText("s", 10, textBase);

        ctx.fillStyle = "#FFFF00";
        ctx.font      = "14px Calibri";
        ctx.fillText("Acertos: " + stats.correct, 30, textBase);
        ctx.fillText("Fase: " + phaseNumber, 260, textBase);
    }

    function redrawBlock(pos) {
        map.drawBlock(Math.floor(pos.y/10), Math.floor(pos.x/10), ctx);
        map.drawBlock(Math.ceil(pos.y/10), Math.ceil(pos.x/10), ctx);
    }

    function mainDraw() { 

        var diff, u, i, len, nScore;
        
        ghostPos = [];
        ensureGhostDistanceField(currentUserTile);

        for (i = 0, len = ghosts.length; i < len; i += 1) {
            ghostPos.push(ghosts[i].move(ctx));
        }
        u = user.move(ctx);
        
        for (i = 0, len = ghosts.length; i < len; i += 1) {
            redrawBlock(ghostPos[i].old);
        }
        redrawBlock(u.old);
        
        for (i = 0, len = ghosts.length; i < len; i += 1) {
            ghosts[i].draw(ctx);
        }                     
        user.draw(ctx);
        answerManager.draw(ctx, tick);
        
        userPos = u["new"];
        currentUserTile = coordToTile(userPos);
        ensureGhostDistanceField(currentUserTile);
        
        var answerItem = answerManager.checkCollision(userPos);
        if (answerItem) {
            handleAnswerCollision(answerItem);
            if (state !== PLAYING) {
                return;
            }
        }
        
        for (i = 0, len = ghosts.length; i < len; i += 1) {
            if (collided(userPos, ghostPos[i]["new"])) {
                if (ghosts[i].isVunerable()) { 
                    audio.play("eatghost");
                    ghosts[i].eat();
                    eatenCount += 1;
                    nScore = eatenCount * 50;
                    drawScore(nScore, ghostPos[i]);
                    user.addScore(nScore);                    
                    setState(EATEN_PAUSE);
                    timerStart = tick;
                } else if (ghosts[i].isDangerous()) {
                    audio.play("die");
                    setState(DYING);
                    timerStart = tick;
                }
            }
        }                             
    };

    function mainLoop() {

        var diff;

        if (state !== PAUSE) { 
            ++tick;
        }

        updatePowerState();

        if (state === PLAYING) {
            mainDraw();
        } else if (state === WAITING && stateChanged) {            
            stateChanged = false;
            map.draw(ctx);
            dialog("Pressione N para iniciar");            
        } else if (state === EATEN_PAUSE && 
                   (tick - timerStart) > (Pacman.FPS / 3)) {
            map.draw(ctx);
            setState(PLAYING);
        } else if (state === DYING) {
            if (tick - timerStart > (Pacman.FPS * 2)) { 
                loseLife();
            } else { 
                redrawBlock(userPos);
                for (i = 0, len = ghosts.length; i < len; i += 1) {
                    redrawBlock(ghostPos[i].old);
                    ghostPos.push(ghosts[i].draw(ctx));
                }                                   
                user.drawDead(ctx, (tick - timerStart) / (Pacman.FPS * 2));
            }
        } else if (state === COUNTDOWN) {
            
            diff = 5 + Math.floor((timerStart - tick) / Pacman.FPS);
            
            if (diff === 0) {
                map.draw(ctx);
                setState(PLAYING);
            } else {
                if (diff !== lastTime) { 
                    lastTime = diff;
                    map.draw(ctx);
                    dialog("Começando em: " + diff);
                }
            }
        } else if (state === QUESTION_PAUSE) {
            if ((tick - timerStart) >= questionTransitionTicks()) {
                processPendingQuestion();
            }
        }

        drawFooter();
    }

    function eatenPill(duration) {
        activatePower(duration);
    };
    
    function completedLevel() {
        return;
    };

    function keyPress(e) { 
        if (state !== WAITING && state !== PAUSE) { 
            e.preventDefault();
            e.stopPropagation();
        }
    };
    
    function init(wrapper, options) {
        
        var config = options || {},
            phases = config.phases || [],
            root   = config.audioRoot || (config.settings && config.settings.audioRoot) || "assets/audio/",
            i, len, ghost,
            blockSize = wrapper.offsetWidth / 19,
            canvas    = document.createElement("canvas"),
            extension;

        initHud();

        if (!phases.length) {
            setQuestionText("Nenhuma fase configurada.");
            setFeedback("Adicione perguntas no arquivo config/questions.json", "negative");
            return;
        }

        settings = normalizeSettings(config.settings);
        GameConfig.settings = settings;
        GameConfig.phases = phases;
        ghostAIConfig = settings.ghostAI || null;
        ghostDistanceField = null;
        ghostDistanceTarget = null;
        ghostDistanceFieldTick = -1;
        homeDistanceField = null;
        homeDistanceFieldTick = -1;

        questionManager = new QuestionManager(phases, settings);
        questionManager.reset();
        applyPhaseSettings(questionManager.currentPhase());
        phaseNumber = 1;

        canvas.setAttribute("width", (blockSize * 19) + "px");
        canvas.setAttribute("height", (blockSize * 22) + 30 + "px");

        wrapper.appendChild(canvas);

        ctx  = canvas.getContext('2d');

        audio = new Pacman.Audio({"soundDisabled":soundDisabled});
        map   = new Pacman.Map(blockSize);
        ensureHomeDistanceField();
        answerManager = new AnswerManager(map, settings);
        user  = new Pacman.User({ 
            "completedLevel" : completedLevel, 
            "eatenPill"      : eatenPill,
            "initialLives"   : settings.initialLives,
            "maxLives"       : settings.maxLives
        }, map, {
            "initialLives" : settings.initialLives,
            "maxLives"     : settings.maxLives
        });
        user.setInitialLives(settings.initialLives, settings.maxLives);

        for (i = 0, len = ghostSpecs.length; i < len; i += 1) {
            ghost = new Pacman.Ghost({
                "getTick": getTick,
                "getNextDirection": getGhostAIDirection
            }, map, ghostSpecs[i]);
            ghosts.push(ghost);
        }
        
        map.draw(ctx);

        resetStats();
        stats.lives = user.getLives();
        updateHudStats();
        setQuestionText("Pressione N para iniciar a fase 1");
        setFeedback("Pronto para aprender? Pressione N para começar.", "neutral");
        updatePowerHud(0);

        if (typeof root !== "string" || !root.length) {
            root = "assets/audio/";
        }
        if (root.charAt(root.length - 1) !== "/") {
            root += "/";
        }

        extension = "wav";
        if (Modernizr.audio && typeof Modernizr.audio.wav === "string" && Modernizr.audio.wav.length) {
            extension = "wav";
        }

        var audio_files = [
            ["start", root + "start." + extension],
            ["correct", root + "correct." + extension],
            ["wrong", root + "wrong." + extension],
            ["die", root + "die." + extension],
            ["eatghost", root + "eatghost." + extension],
            ["eatpill", root + "eatpill." + extension],
            ["eating", root + "eating." + extension],
            ["eating2", root + "eating2." + extension]
        ];

        load(audio_files, function() { loaded(); });
    };

    function load(arr, callback) { 
        
        if (arr.length === 0) { 
            callback();
        } else { 
            var x = arr.pop();
            audio.load(x[0], x[1], function() { load(arr, callback); });
        }
    };
        
    function loaded() {

        dialog("Press N to Start");
        
        document.addEventListener("keydown", keyDown, true);
        document.addEventListener("keypress", keyPress, true); 
        
        timer = window.setInterval(mainLoop, 1000 / Pacman.FPS);
    };
    
    return {
        "init" : init
    };
    
}());

/* Human readable keyCode index */
var KEY = {'BACKSPACE': 8, 'TAB': 9, 'NUM_PAD_CLEAR': 12, 'ENTER': 13, 'SHIFT': 16, 'CTRL': 17, 'ALT': 18, 'PAUSE': 19, 'CAPS_LOCK': 20, 'ESCAPE': 27, 'SPACEBAR': 32, 'PAGE_UP': 33, 'PAGE_DOWN': 34, 'END': 35, 'HOME': 36, 'ARROW_LEFT': 37, 'ARROW_UP': 38, 'ARROW_RIGHT': 39, 'ARROW_DOWN': 40, 'PRINT_SCREEN': 44, 'INSERT': 45, 'DELETE': 46, 'SEMICOLON': 59, 'WINDOWS_LEFT': 91, 'WINDOWS_RIGHT': 92, 'SELECT': 93, 'NUM_PAD_ASTERISK': 106, 'NUM_PAD_PLUS_SIGN': 107, 'NUM_PAD_HYPHEN-MINUS': 109, 'NUM_PAD_FULL_STOP': 110, 'NUM_PAD_SOLIDUS': 111, 'NUM_LOCK': 144, 'SCROLL_LOCK': 145, 'SEMICOLON': 186, 'EQUALS_SIGN': 187, 'COMMA': 188, 'HYPHEN-MINUS': 189, 'FULL_STOP': 190, 'SOLIDUS': 191, 'GRAVE_ACCENT': 192, 'LEFT_SQUARE_BRACKET': 219, 'REVERSE_SOLIDUS': 220, 'RIGHT_SQUARE_BRACKET': 221, 'APOSTROPHE': 222};

(function () {
	/* 0 - 9 */
	for (var i = 48; i <= 57; i++) {
        KEY['' + (i - 48)] = i;
	}
	/* A - Z */
	for (i = 65; i <= 90; i++) {
        KEY['' + String.fromCharCode(i)] = i;
	}
	/* NUM_PAD_0 - NUM_PAD_9 */
	for (i = 96; i <= 105; i++) {
        KEY['NUM_PAD_' + (i - 96)] = i;
	}
	/* F1 - F12 */
	for (i = 112; i <= 123; i++) {
        KEY['F' + (i - 112 + 1)] = i;
	}
})();

Pacman.WALL    = 0;
Pacman.BISCUIT = 1;
Pacman.EMPTY   = 2;
Pacman.BLOCK   = 3;
Pacman.PILL    = 4;



document.addEventListener("DOMContentLoaded", function () {
  var el = document.getElementById("pacman"),
      questionEl = document.getElementById("question-text"),
      feedbackEl = document.getElementById("feedback-text");

  function browserWarning() {
    if (el) {
      el.innerHTML = "Sorry, needs a decent browser<br /><small>" +
        "(firefox 3.6+, Chrome 4+, Opera 10+ and Safari 4+)</small>";
    }
    if (feedbackEl) {
      feedbackEl.textContent = "Atualize seu navegador para jogar.";
      feedbackEl.setAttribute("data-state", "negative");
    }
  }

  if (typeof Modernizr === "undefined" ||
      !Modernizr.canvas || !Modernizr.localstorage ||
      !Modernizr.audio || !(Modernizr.audio.ogg || Modernizr.audio.mp3)) {
    browserWarning();
    return;
  }

  if (questionEl) {
    questionEl.textContent = "Carregando recursos educacionais...";
  }
  if (feedbackEl) {
    feedbackEl.textContent = "";
    feedbackEl.removeAttribute("data-state");
  }

  Promise.all([
    fetchJSON("config/game-settings.json"),
    fetchJSON("config/questions.json")
  ])
    .then(function (results) {
      var settingsData = results[0] || {},
          questionsData = results[1] || {},
          phases = questionsData.phases || [];

      if (!phases.length) {
        throw new Error("Nenhuma fase encontrada em config/questions.json");
      }

      PACMAN.init(el, {
        "settings"  : settingsData,
        "phases"    : phases,
        "audioRoot" : settingsData.audioRoot
      });
    })["catch"](function (err) {
      if (feedbackEl) {
        feedbackEl.textContent = err.message;
        feedbackEl.setAttribute("data-state", "negative");
      }
      if (el) {
        el.innerHTML = "<div style='color:#ff5252; padding:8px; text-align:center;'>" +
          "Falha ao iniciar o jogo.<br>" + err.message + "</div>";
      }
    });
});


