import {
  defaultPostFilterFunction,
  defaultSingleValueStateMachine,
  IMediaParser,
  IPostFilterHandler,
  IPreFilterHandler,
  IRegexHandler,
  IValueState,
} from './_shared'
import { SEPARATOR } from '../const'
import { _ } from '../util'

// /(?<=\.)[^.]+$/gi, check on look ahead, look behind and all.
const parserStore: IMediaParser[] = [
  {
    name: 'episode',
    targetRegex: [
      {
        regex: /(?<season>\d{1,3})[\s_-]+(?<episode>\d{1,3}[a-z]?)(?=[\s_-]*?(?:\[.*?])?\.(?:mkv|mp4)$)/gi, // episode at the last of media
        variableNames: ['season', 'episode'],
      },
      {
        regex: /(?<=[\s_-])(?<episode>\d{1,3}[a-z]?(?=[\s_-]*?(?:\[.*?\])?\.(?:mkv|mp4)$))/g, // episode at the last of media
      },
    ],
  },
  {
    name: 'extension',
    targetRegex: [
      {
        regex: /(?<extension>\.(?:mkv|mp4|m4p|webm|mpg|mp2|mpeg|mpe|mpv|m2v))\s*$/gi,
      },
    ],
  },
  {
    name: 'releaseType',
    targetRegex: [
      {
        regex:
          /[\s[(._-](?<releaseType>(CAM-Rip|CAM|HDCAM|TS|HDTS|TELESYNC|PDVD|PreDVDRip|Uncommon|WP|WORKPRINT|Extremely rare|TC|HDTC|TELECINE|DVDRemux|PPV|PPVRip|SCR|SCREENER|DVDSCR|DVDSCREENER|BDSCR|BD|WEBSCREENER|DDC|R5|R5\.LINE|R5\.AC3\.5\.1\.HQ|DVDRip|DVDMux|DVDR|DVD-Full|Full-Rip|ISO rip|lossless rip|untouched rip|DVD-5|DVD-9|DSR|DSRip|SATRip|DTHRip|DVBRip|HDTV|PDTV|DTVRip|TVRip|HDTVRip|VODRip|VODR|HC|HD-Rip|WEB-Cap|WEBCAP|WEB Cap|HDRip|WEB-DLRip|WEBRip|WEB Rip|WEB-Rip|WEB-DL|WEBDL|WEB DL|WEB|Blu-Ray|BluRay|BLURAY|BDRip|BRip|BRRip|BD25|BD50|BD66|BD100|BD5|BD9|BDMV|BDISO|COMPLETE\.BLURAY|VBR|CBR|DVT))[\s\])._-]/gi,
      },
    ],
  },
  {
    name: 'resolution',
    targetRegex: [
      {
        regex: /[-_.([\s]\s*(?<resolution>1080p|2160p|720p|480p|400p|4k|\d{3,4}X\d{3,4})\s*(?:[.)_\-\]\s]|$)/gi,
        postProcess: (group) =>
          ({
            resolution: (group?.['resolution']?.match(/4k/gi)?.length ?? 0) > 0 ? '2160p' : group?.['resolution'],
          }) as Record<string, string>,
      },
    ],
  },
  {
    name: 'releaseYear',
    targetRegex: [
      {
        regex: /[([](?<releaseYear>(19\d{2}|20\d{2})(?:[-_.](19\d{2}|20\d{2}))?)[)\]]/gi, // if bracketed, pick first from bracket
      },
      {
        regex: /(?<releaseYear>(19\d{2}|20\d{2}))(?:[-_.])(?!=19\d{2}|20\d{2})/gi, // it can happen year is in start, in that case just do a look ahead.
        selection: 'TAIL',
      },
      {
        regex: /[-_(.[\s](?<releaseYear>(?:19\d{2}|20\d{2})(?:[-_.](19\d{2}|20\d{2}))?)[-).\]\s]?(?!(19\d{2}|20\d{2}))/gi, // 2006-2013
        selection: 'TAIL',
      },
    ],
  },
  {
    name: 'season',
    targetRegex: [
      {
        //12x13
        regex: /[\s.({_-]((?<season>\d{1,4})|(=::=))x(?<episode>\d{1,2})[\s.({_-]/gi,
        variableNames: ['season', 'episode'],
        postProcess: (group: Record<string, string>) => {
          const season = group?.['season']
          const episode = group?.['episode']
          return {
            season: season ? `S${season}` : undefined,
            episode: episode ? `E${episode}` : undefined,
          } as Record<string, string>
        },
        relation: 'OR',
      },
      {
        regex: /[.([\s-]?\s*(?<season>S\d{1,2}(?:=E\d{1,3}([.\s-]\d{1,3})?)?)(?<episode>E\d{1,3}([.\s-]\d{1,3})?)?\s*[.)\]\s-]?\s*/gi, //S01E01
        variableNames: ['season', 'episode'],
      },
      {
        regex: /[.([\s-]?\s*(?<season>\d{1,2}(?:st|nd|rd|th)[.[\s]+Seasons?)([.([\s-]+(?<episode>\d{1,3}(?:[.\s~-]+\d+)?)?)?\s*[-.)\]\s]?\s*/gi, // 2nd season - 01~12 clean range afterwards
        variableNames: ['season', 'episode'],
        postProcess: (group: Record<string, string>) => {
          const season = group?.['season']?.split('eason')?.[0]?.replaceAll(/[a-z]/gi, '').trim()
          const episode = group?.['episode']?.replaceAll('~', '-')?.replaceAll('.', '-')
          return {
            season: season ? `S${season}` : undefined,
            episode: episode ? `E${episode}` : undefined,
          } as Record<string, string>
        },
      },
      {
        regex: /[.([\s-]?\s*(?<season>Seasons?[.\s-]*\d{1,2}(?:[-.\s])*(?:Seasons?)?[.\s-]*(?:\d{1,2})?)/gi, // Season 6 - 7, check to ensure no multiple seasons resolved.
        postProcess: (group: Record<string, string>) => {
          const season = group?.['season']?.replaceAll(/seasons?/gi, '')?.trim()
          return {
            season: season ? `S${season}` : undefined,
          } as Record<string, string>
        },
      },
      {
        // fix for [s9-s10us] Digimon
        regex: /[.([\s-]?\s*(?<!\w)(?<season>S\d{1,2}(?:[\s.-]S?\d{1,2})?)\s*[-.)\]\s]?\s*(?!\w)/gi, // S01-S06
        postProcess: (group: Record<string, string>) => {
          const season = group?.['season']?.replaceAll(/s/gi, '')?.replaceAll(/\s+/gi, ' ')
          return {
            season: season ? `S${season}` : undefined,
          } as Record<string, string>
        },
      },
      {
        regex: /[\s_-]+(?<episode>\d{1,3}[\s_-]+\d{1,3})(?:$|[\s_-])/gi,
        variableNames: ['episode'],
      },
    ],
  },
  {
    name: 'special',
    targetRegex: [
      {
        // NCED, NCOP, Opening, Ending, christmas.special Holiday.Special
        regex: /[-\s_[{(]?(?<special>NCED|NCOP|Opening|Ending|(?:(christmas|holiday)[\s._-]speciale?)|(special[\s._-]ending)|([\s[](?:sp|pv|ova)\d*?[\s\]]))/gi,
      },
    ],
    // postFilters: [(input) => input],
  },
  {
    name: 'title',
    filters: [
      (input) => input.replaceAll(/(The)?[\s.-_]?Complete?[\s.-_]?Collection/gi, ''),
      (input) =>
        _.splitAndFirst(input, SEPARATOR, /\s\d{1,3}$/i, /seasons?[\s_-]*\d{1,3}/i, /seasons?\d{1,3}/i)
          .replaceAll(/[[{(].+?([}\])])/gi, '')
          .replaceAll(/[[(].+?$/gi, '')
          .replaceAll(/【.*】/gi, '')
          .replaceAll(/^www\.\w+\.\w{1,4}/gi, '')
          .replaceAll(/[-_[\].)(]/gi, ' ')
          .replaceAll(/\s+/gi, ' ')
          .trim(),
      (input) => {
        // eslint-disable-next-line no-control-regex
        const foreignCharacterRegex = /[^\u0000-\u05C0\u2100-\u214F]+/gi
        const undesiredCharactersRegex = /[~"'!]/gi
        return input
          .split('')
          .filter((i) => !i.match(foreignCharacterRegex)?.length)
          .filter((i) => !i.match(undesiredCharactersRegex)?.length)
          .join('')
          ?.replaceAll(/\s+/gi, ' ')
          .trim()
      },
    ],
    targetRegex: [
      {
        regex: /(?<title>.+)/gi,
      },
    ],
  },
]

export function processLink(input: string): IValueState {
  let currIp = input
  const processedResults: IValueState[] = []
  parserStore.forEach((parser) => {
    const filters = (parser as IPreFilterHandler).filters || []
    filters.forEach((filter) => {
      if (typeof filter == 'function') {
        currIp = filter(currIp)
      } else {
        currIp = currIp.replaceAll(filter.target, filter.substitute)
      }
    })

    const regexParser = parser as IRegexHandler
    let searchResult: IValueState | null = null
    if (regexParser.targetRegex) {
      const stateMachine = regexParser.stateMachine || defaultSingleValueStateMachine
      searchResult = stateMachine({ index: 0, parent: regexParser }, currIp)
    }
    if (searchResult) {
      const postFilters = (parser as IPostFilterHandler)?.postFilters || [defaultPostFilterFunction]
      postFilters.forEach((filter) => {
        if (typeof filter == 'function') {
          currIp = filter(currIp, searchResult)
        } else {
          currIp = currIp.replaceAll(filter.target, filter.substitute)
        }
      })
      processedResults.push(searchResult)
    }
  })
  return processedResults.reduce((agg, curr) => {
    Object.entries(curr).forEach(([key, value]) => {
      const aggVal = agg[key]
      if (aggVal) {
        aggVal.push(...value)
      } else {
        agg[key] = value
      }
    })
    return agg
  }, {})
}

console.log(processLink('American Dad! Seasons 1 to 18 (S01-S18) Remastered Edition [NVEnc 10Bit H265 1080p][AAC 6Ch][English Subs]'))
