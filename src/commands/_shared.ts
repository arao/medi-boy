import { IValueState } from '../engine/_shared'
import { processLink } from '../engine'

export function generateMediaPath(parentDetails: IValueState, child: string) {
  const childDetails: IValueState = processLink(child)
  const {
    title: parentTitle,
    season: parentSeason,
    episode: parentEpisode,
    year: parentYear,
    special: parentSpecial,
    // resolution: parentResolution
  } = parentDetails
  const {
    title: childTitle,
    season: childSeason,
    episode: childEpisode,
    year: childYear,
    special: childSpecial,
    // resolution: childResolution,
    // extension: childExtension,
  } = childDetails

  // const extension = [...(childExtension || [])]?.[0]
  const releaseYear = [...(childYear || []), ...(parentYear || [])].filter((i) => !isRange(i)).filter((i) => i)?.[0]
  // const resolution = [...(childResolution || []), ...(parentResolution || [])].filter((i) => !isRange(i))?.[0]
  const hasSeasonRange = [...(childSeason || []), ...(parentSeason || [])].filter((i) => isRange(i)).length > 0
  const season = [...(childSeason || []), ...(parentSeason || [])].filter((i) => !isRange(i)).filter((i) => i)?.[0]
  const hasEpisode = [...(childEpisode || []), ...(parentEpisode || [])].length > 0
  // const episode = [...(childEpisode || []), ...(parentEpisode || [])].filter((i) => !isRange(i))?.[0]
  const title = [...(parentTitle || []), ...(childTitle || [])]
    .filter((i) => !isRange(i))
    .filter((i) => i)
    .filter((i) => i.length > 0)
    .sort(titleCharacterComparator)?.[0]
  const special = [...(childSpecial || []), ...(parentSpecial || [])].filter((i) => !isRange(i))?.[0]

  const pascalTitle = camelCase(title)

  /**
   * - if episode and season, and special => TV/title/season/extra/
   * - if episode and season, and no special => TV/title/season/
   * - if episode and no season, and no special => TV/title/
   * - if episode and no season, and special => TV/title/extra/
   * - if no episode and season, and special => TV/title/season/extra/
   * - if no episode and season, and no special => TV/title/season
   * - if no episode and no season, and no special => Movie/title
   * - if no episode and no season, and special => Movie/title/extra   => never seen this, but lets do the distribution.
   */

  if (hasEpisode && season) {
    return `TV/${pascalTitle}${releaseYear ? ` (${releaseYear})` : ''}/Season ${season?.replaceAll(/s/gi, '')}${special ? '/Special' : ''}/${child}`
  } else if (hasSeasonRange || (hasEpisode && !season) || (season && !hasEpisode)) {
    return `TV/${pascalTitle}${releaseYear ? ` (${releaseYear})` : ''}${special ? '/Special' : ''}/${child}`
  } else {
    return `Movie/${pascalTitle}${releaseYear ? ` (${releaseYear})` : ''}${special ? '/Special' : ''}/${child}`
  }
}

const NON_ENGLISH_WEIGHT = /[^a-z1-9]/gi

function titleCharacterComparator(a: string, b: string) {
  const a_is_collection = (a.match(/collection|Complete|Complete ?Series?|Series?$/gi)?.length || 0) > 0
  const b_is_collection = (b.match(/collection|Complete|Complete ?Series?|Series?$/gi)?.length || 0) > 0
  if (a_is_collection && !b_is_collection) {
    return 1
  } else if (!a_is_collection && b_is_collection) {
    return -1
  } else {
    const a_non_english_char =
      a
        .replaceAll(/à/gi, 'a')
        .match(NON_ENGLISH_WEIGHT)
        ?.filter((i) => i.trim())?.length ?? 0
    const b_non_english_char =
      b
        .replaceAll(/à/gi, 'a')
        .match(NON_ENGLISH_WEIGHT)
        ?.filter((i) => i.trim()).length ?? 0
    if (a_non_english_char && !b_non_english_char) {
      return 1
    } else if (!a_non_english_char && b_non_english_char) {
      return -1
    } else {
      return b_non_english_char - a_non_english_char
    }
  }
}

function isRange(val: string) {
  return (val?.match(/-/gi)?.length ?? 0) > 0
}

function camelCase(str?: string) {
  if (str == null) {
    return null
  }
  // converting all characters to lowercase
  const ans = str.toLowerCase()

  // Returning string to camelcase
  return ans
    .split(' ')
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
    .join(' ')
}
