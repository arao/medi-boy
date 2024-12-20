export class _ {
  static splitAndFirst(input: string, ...targets: (string | RegExp)[]) {
    let newIp = input
    targets.forEach((target) => {
      newIp = newIp
        ?.split(target)
        ?.map((i) => i.trim())
        ?.filter((i) => i.length > 0)?.[0] as string
    })
    return newIp || ''
  }
}
