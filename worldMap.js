import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {object} MapLocation
 * @property {string} name
 * @property {string} description
 */

/**
 * @typedef {object} MapSection
 * @property {number} id
 * @property {string} title
 * @property {string} description
 * @property {MapLocation[]} locations
 */

/**
 * Parses the content of Read_MAP.txt into a structured JSON object.
 * @param {string} textContent
 * @returns {MapSection[]}
 *
 * NOTE: Changed to a const arrow function and placed before its usage
 * to prevent potential "Temporal Dead Zone" (TDZ) errors if the code were
 * refactored to have top-level calls.
 */
const parseMapFile = (textContent) => {
  const lines = textContent.split(/\r?\n/).filter(line => line.trim() !== '');
  /** @type {MapSection[]} */
  const sections = [];
  /** @type {MapSection | null} */
  let currentSection = null;

  for (const line of lines) {
    const sectionMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (sectionMatch) {
      currentSection = {
        id: parseInt(sectionMatch[1], 10),
        title: sectionMatch[2].trim(),
        description: '',
        locations: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) continue;

    const locationMatch = line.match(/^(.*?):\s+(.*)/);
    if (locationMatch) {
      currentSection.locations.push({
        name: locationMatch[1].trim(),
        description: locationMatch[2].trim(),
      });
    } else if (currentSection.locations.length === 0) {
      // This line is the section description
      currentSection.description = line.trim();
    }
  }

  return sections;
};

export const getWorldMapLocations = async (mapFilePath) => {
  // Assuming the map file is relative to the project root
  const fullPath = path.resolve(process.cwd(), mapFilePath);
  const content = await fs.readFile(fullPath, 'utf-8');
  return parseMapFile(content);
};