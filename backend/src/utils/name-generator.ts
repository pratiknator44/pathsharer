import json from "./names.json"

function getRandomItem(arr: any[]) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function nameGenerator() {
    const adjectives = json.adjectives;
    const nouns = json.nouns;
    return `${getRandomItem(adjectives)} ${getRandomItem(nouns)}`;
}
export default nameGenerator