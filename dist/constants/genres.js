"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENRE_SYSTEM = void 0;
exports.getAllGenres = getAllGenres;
exports.getAllSubgenres = getAllSubgenres;
exports.getSubgenresForGenre = getSubgenresForGenre;
exports.getGenreForSubgenre = getGenreForSubgenre;
exports.isValidGenre = isValidGenre;
exports.isValidSubgenre = isValidSubgenre;
exports.calculateGenreSimilarity = calculateGenreSimilarity;
exports.GENRE_SYSTEM = {
    rock: {
        name: "Rock",
        description: "Guitar-driven music with strong rhythm",
        subgenres: [
            "alternative-rock",
            "classic-rock",
            "hard-rock",
            "heavy-metal",
            "punk-rock",
            "progressive-rock",
            "indie-rock",
            "grunge",
            "southern-rock",
            "garage-rock",
            "psychedelic-rock",
            "blues-rock",
            "folk-rock",
            "art-rock"
        ]
    },
    pop: {
        name: "Pop",
        description: "Popular mainstream music",
        subgenres: [
            "mainstream-pop",
            "indie-pop",
            "electro-pop",
            "k-pop",
            "teen-pop",
            "dance-pop",
            "synthpop",
            "pop-rock",
            "britpop",
            "power-pop",
            "bubblegum-pop"
        ]
    },
    electronic: {
        name: "Electronic",
        description: "Computer-generated and synthesized music",
        subgenres: [
            "house",
            "techno",
            "trance",
            "dubstep",
            "drum-and-bass",
            "ambient",
            "edm",
            "breakbeat",
            "chillout",
            "downtempo",
            "progressive-house",
            "deep-house",
            "garage",
            "jungle",
            "minimal",
            "electro"
        ]
    },
    hiphop: {
        name: "Hip-Hop",
        description: "Rhythmic spoken lyrics over beats",
        subgenres: [
            "rap",
            "trap",
            "old-school-hip-hop",
            "conscious-rap",
            "gangsta-rap",
            "east-coast-hip-hop",
            "west-coast-hip-hop",
            "southern-hip-hop",
            "boom-bap",
            "mumble-rap",
            "drill",
            "crunk"
        ]
    },
    jazz: {
        name: "Jazz",
        description: "Improvised music with complex harmonies",
        subgenres: [
            "smooth-jazz",
            "bebop",
            "swing",
            "fusion",
            "acid-jazz",
            "cool-jazz",
            "free-jazz",
            "contemporary-jazz",
            "latin-jazz",
            "big-band",
            "vocal-jazz",
            "avant-garde-jazz",
            "hard-bop"
        ]
    },
    country: {
        name: "Country",
        description: "American folk music with rural themes",
        subgenres: [
            "modern-country",
            "classic-country",
            "bluegrass",
            "americana",
            "alt-country",
            "country-rock",
            "outlaw-country",
            "honky-tonk",
            "country-pop",
            "western",
            "nashville-sound",
            "red-dirt"
        ]
    },
    rnb: {
        name: "R&B/Soul",
        description: "Rhythm and blues with soulful vocals",
        subgenres: [
            "contemporary-rnb",
            "classic-soul",
            "neo-soul",
            "funk",
            "motown",
            "gospel",
            "blues",
            "urban-contemporary",
            "quiet-storm",
            "new-jack-swing"
        ]
    },
    latin: {
        name: "Latin",
        description: "Music from Latin American cultures",
        subgenres: [
            "salsa",
            "bachata",
            "merengue",
            "reggaeton",
            "latin-pop",
            "mariachi",
            "cumbia",
            "tango",
            "bossa-nova",
            "flamenco",
            "tejano",
            "latin-rock",
            "banda",
            "ranchera"
        ]
    },
    world: {
        name: "World Music",
        description: "Traditional and contemporary international music",
        subgenres: [
            "african",
            "indian",
            "middle-eastern",
            "celtic",
            "folk",
            "traditional",
            "ethnic",
            "world-fusion",
            "bollywood",
            "reggae",
            "caribbean",
            "asian-pop",
            "klezmer",
            "aboriginal"
        ]
    },
    classical: {
        name: "Classical",
        description: "Traditional orchestral and art music",
        subgenres: [
            "orchestral",
            "chamber-music",
            "opera",
            "baroque",
            "romantic",
            "contemporary-classical",
            "piano",
            "choral",
            "symphony",
            "concerto",
            "medieval",
            "renaissance"
        ]
    },
    alternative: {
        name: "Alternative",
        description: "Non-mainstream and experimental music",
        subgenres: [
            "indie",
            "shoegaze",
            "post-rock",
            "experimental",
            "noise",
            "post-punk",
            "new-wave",
            "gothic",
            "industrial",
            "lo-fi",
            "math-rock",
            "emo"
        ]
    },
    reggae: {
        name: "Reggae",
        description: "Jamaican music with distinctive rhythm",
        subgenres: [
            "roots-reggae",
            "dancehall",
            "dub",
            "ska",
            "rocksteady",
            "ragga",
            "lovers-rock",
            "digital-reggae"
        ]
    },
    blues: {
        name: "Blues",
        description: "American folk music expressing melancholy",
        subgenres: [
            "chicago-blues",
            "delta-blues",
            "electric-blues",
            "acoustic-blues",
            "texas-blues",
            "british-blues",
            "contemporary-blues"
        ]
    }
};
function getAllGenres() {
    return Object.keys(exports.GENRE_SYSTEM);
}
function getAllSubgenres() {
    return Object.values(exports.GENRE_SYSTEM)
        .flatMap(genre => genre.subgenres);
}
function getSubgenresForGenre(genre) {
    return exports.GENRE_SYSTEM[genre]?.subgenres || [];
}
function getGenreForSubgenre(subgenre) {
    for (const [genreKey, genreInfo] of Object.entries(exports.GENRE_SYSTEM)) {
        if (genreInfo.subgenres.includes(subgenre)) {
            return genreKey;
        }
    }
    return null;
}
function isValidGenre(genre) {
    return genre in exports.GENRE_SYSTEM;
}
function isValidSubgenre(subgenre) {
    return getAllSubgenres().includes(subgenre);
}
function calculateGenreSimilarity(genre1, genre2) {
    if (genre1 === genre2)
        return 1.0;
    const similarityGroups = [
        ['rock', 'alternative', 'blues'],
        ['pop', 'rnb', 'electronic'],
        ['country', 'folk', 'americana'],
        ['jazz', 'blues', 'classical'],
        ['hiphop', 'rnb', 'electronic'],
        ['latin', 'world', 'reggae'],
        ['electronic', 'alternative', 'experimental']
    ];
    for (const group of similarityGroups) {
        if (group.includes(genre1) && group.includes(genre2)) {
            return 0.7;
        }
    }
    return 0.1;
}
