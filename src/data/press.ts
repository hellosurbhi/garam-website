export interface PressItem {
  title: string;
  source: string;
  url?: string;
  type: "podcast" | "article" | "press";
}

export const pressItems: PressItem[] = [
  {
    title: "Garam Masala Dating on Doctor Lawyer Comedian",
    source: "Doctor Lawyer Comedian",
    url: "https://www.youtube.com/watch?v=PyjeLMZohqY",
    type: "podcast",
  },
  {
    title: "Garam Masala Dating on Gen Zenophobic",
    source: "Gen Zenophobic",
    url: "https://www.youtube.com/watch?v=Es04TqhwkmY",
    type: "podcast",
  },
  {
    title: "Garam Masala Dating on Big Silly World",
    source: "Big Silly World",
    url: "https://www.youtube.com/watch?v=wEVFBODzYdI",
    type: "podcast",
  },
];
