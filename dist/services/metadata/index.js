"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testIcecastMetadata = exports.testExistingMetadata = exports.detectStreamMetadata = void 0;
var detection_1 = require("./detection");
Object.defineProperty(exports, "detectStreamMetadata", { enumerable: true, get: function () { return detection_1.detectStreamMetadata; } });
Object.defineProperty(exports, "testExistingMetadata", { enumerable: true, get: function () { return detection_1.testExistingMetadata; } });
var icecast_1 = require("./extractors/icecast");
Object.defineProperty(exports, "testIcecastMetadata", { enumerable: true, get: function () { return icecast_1.testIcecastMetadata; } });
