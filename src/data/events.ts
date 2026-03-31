export interface EventEntry {
  date: string;
  city: string;
  url: string;
  hidden?: boolean;
  isoDate?: string; // YYYY-MM-DD — present only for events with a specific date
}

export const events: EventEntry[] = [
  {
    date: "Feb 22",
    city: "Manhattan, New York",
    url: "https://www.eventbrite.com/e/garam-masala-dating-a-belated-valentines-day-tickets-1982103088695?aff=ebdsshcopyurl&utm-campaign=social&utm-content=attendeeshare&utm-medium=discovery&utm-term=",
    isoDate: "2026-02-22",
  },
  {
    date: "Mar 7",
    city: "San Diego",
    url: "https://www.eventbrite.com/e/garam-masala-dating-live-in-san-diego-tickets-1983622967694?lid=ipmjzd9i2ysd&utm_source=braze&utm_medium=ebml&utm_campaign=clpo_ceex_lcm_fad_mec_mc_mum_0_0_eventpublished&utm_term=Main_EventPublishedSubPaid_HeroSummary_other%20feature%20usage&utm_content=d83bc845-0544-4274-a9dd-e152eac1a1f7__699895f399367e11f0839776e4c4c33f__f605d558-54e9-4fbc-aef1-2c09bcef5c27",
    isoDate: "2026-03-07",
  },
  {
    date: "Mar 15",
    city: "Manhattan, New York",
    url: "https://www.eventbrite.com/e/garam-masala-dating-st-patricks-day-tickets-1982103088695?aff=garamsite",
    isoDate: "2026-03-15",
  },
  {
    date: "Apr 4",
    city: "Chicago",
    url: "https://www.eventbrite.com/e/saturday-april-4-garam-masala-dating-tickets-1983144430376?aff=oddtdtcreator",
    hidden: true,
    isoDate: "2026-04-04",
  },
  {
    date: "Apr 19",
    city: "Manhattan, New York",
    url: "https://www.eventbrite.com/e/garam-masala-dating-420-blazin-in-love-tickets-1985330936274?aff=garamsite",
    isoDate: "2026-04-19",
  },
  {
    date: "Apr 26",
    city: "Jersey City, New Jersey",
    url: "https://www.eventbrite.com/e/garam-masala-dating-jersey-city-tickets-1986100570270?aff=garamsite",
    isoDate: "2026-04-26",
  },
  {
    date: "TBA",
    city: "Edinburgh",
    url: "#",
  },
  {
    date: "Dec 2026",
    city: "India Tour",
    url: "#",
  },
];
