export const CAFE_THEME_COLORS={
  orange:"#C75A1B",coffee:"#8A4B2A",olive:"#6F7A3D",teal:"#2F6F68",plum:"#76506F",navy:"#243B67",royal:"#2F5FA7",berry:"#9A3E68",maroon:"#7A2639",graphite:"#4B5057",emerald:"#2F7A56",forest:"#3F6842",mint:"#4F8D78",cyan:"#287C91",sky:"#4B86B4",indigo:"#4B4F9A",violet:"#6C4AA1",lavender:"#8A6CAD",magenta:"#A43D82",rose:"#B44F65",coral:"#C65F4A",brick:"#A44832",red:"#B43B32",gold:"#B88422",mustard:"#A87A18",sand:"#A66E45",caramel:"#B86B31",steel:"#567488",slate:"#5E6878",charcoal:"#343A40",
} as const;

export type CafeTheme=keyof typeof CAFE_THEME_COLORS;

export function isCafeTheme(value:string|null|undefined):value is CafeTheme{
  return Boolean(value&&Object.hasOwn(CAFE_THEME_COLORS,value));
}
