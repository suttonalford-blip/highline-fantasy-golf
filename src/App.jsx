import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD98XTU_SfFu9x4F5jqLDdne8_2hfH90qg",
  authDomain: "highline-fantasy-golf.firebaseapp.com",
  databaseURL: "https://highline-fantasy-golf-default-rtdb.firebaseio.com",
  projectId: "highline-fantasy-golf",
  storageBucket: "highline-fantasy-golf.firebasestorage.app",
  messagingSenderId: "875515042100",
  appId: "1:875515042100:web:f0146bbd4a12452c9ead61"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// League Configuration
const LEAGUE_CONFIG = {
  name: "Highline Fantasy Golf League",
  year: 2026,
  teams: [
    { id: 1, name: "Alford", owner: "Alford" },
    { id: 2, name: "Boone", owner: "Boone" },
    { id: 3, name: "Brauntuch", owner: "Brauntuch" },
    { id: 4, name: "Cobos", owner: "Cobos" },
    { id: 5, name: "Ewoldt", owner: "Ewoldt" },
    { id: 6, name: "Greenfield", owner: "Greenfield" },
    { id: 7, name: "Osofsky", owner: "Osofsky" },
    { id: 8, name: "Reed", owner: "Reed" },
    { id: 9, name: "Rollins", owner: "Rollins" },
    { id: 10, name: "Vacanti", owner: "Vacanti" },
  ],
  rosterSize: 7,
  startersRegular: 4,
  startersMajor: 6,
  preDraftStarters: 4,
  majors: ["Masters Tournament", "PGA Championship", "U.S. Open", "The Open"],
  pointsTable: {
    1: 45, 2: 36, 3: 28, 4: 21, 5: 15, 6: 10, 7: 6, 8: 3, 9: 1, 10: 0
  },
  majorMultiplier: 2,
  winnerBonus: 10,
  preDraftTournament: {
    id: "predraft",
    name: "Farmers Insurance Open",
    dates: "Jan 29-Feb 1",
    espnId: "401811930",
    description: "Pre-draft tournament to determine Season 1 draft order"
  },
  season1Tournaments: [
    { id: "s1t1", name: "WM Phoenix Open", dates: "Feb 5-8", espnId: "401811931", isMajor: false },
    { id: "s1t2", name: "AT&T Pebble Beach Pro-Am", dates: "Feb 12-15", espnId: "401811932", isMajor: false },
    { id: "s1t3", name: "The Genesis Invitational", dates: "Feb 19-22", espnId: "401811933", isMajor: false },
    { id: "s1t4", name: "Arnold Palmer Invitational", dates: "Mar 5-8", espnId: "401811935", isMajor: false },
    { id: "s1t5", name: "THE PLAYERS Championship", dates: "Mar 12-15", espnId: "401811937", isMajor: false },
    { id: "s1t6", name: "Masters Tournament", dates: "Apr 9-12", espnId: "401811941", isMajor: true },
    { id: "s1t7", name: "RBC Heritage", dates: "Apr 16-19", espnId: "401811942", isMajor: false },
  ],
  season2Tournaments: [
    { id: "s2t1", name: "Truist Championship", dates: "May 7-10", espnId: "401811945", isMajor: false },
    { id: "s2t2", name: "PGA Championship", dates: "May 14-17", espnId: "401811947", isMajor: true },
    { id: "s2t3", name: "the Memorial Tournament", dates: "Jun 4-7", espnId: "401811950", isMajor: false },
    { id: "s2t4", name: "U.S. Open", dates: "Jun 18-21", espnId: "401811952", isMajor: true },
    { id: "s2t5", name: "Travelers Championship", dates: "Jun 25-28", espnId: "401811953", isMajor: false },
    { id: "s2t6", name: "Genesis Scottish Open", dates: "Jul 9-12", espnId: "401811955", isMajor: false },
    { id: "s2t7", name: "The Open", dates: "Jul 16-19", espnId: "401811957", isMajor: true },
  ]
};

// Determine which tournament to show by default based on today's date:
// prefer a currently-live tournament, then the most recently completed one.
const getDefaultTournamentId = () => {
  const monthMap = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };
  const currentYear = LEAGUE_CONFIG.year || 2026;
  const today = new Date();

  const parseDates = (dateStr) => {
    const crossMonthMatch = dateStr.match(/([A-Za-z]+)\s+(\d+)-([A-Za-z]+)\s+(\d+)/);
    if (crossMonthMatch) {
      const startMonth = monthMap[crossMonthMatch[1].toLowerCase().substring(0, 3)];
      const startDay = parseInt(crossMonthMatch[2]);
      const endMonth = monthMap[crossMonthMatch[3].toLowerCase().substring(0, 3)];
      const endDay = parseInt(crossMonthMatch[4]);
      if (startMonth === undefined || endMonth === undefined) return null;
      return {
        startDate: new Date(currentYear, startMonth, startDay),
        endDate: new Date(currentYear, endMonth, endDay, 23, 59, 59)
      };
    }
    const sameMonthMatch = dateStr.match(/([A-Za-z]+)\s+(\d+)-(\d+)/);
    if (sameMonthMatch) {
      const month = monthMap[sameMonthMatch[1].toLowerCase().substring(0, 3)];
      const startDay = parseInt(sameMonthMatch[2]);
      const endDay = parseInt(sameMonthMatch[3]);
      if (month === undefined) return null;
      return {
        startDate: new Date(currentYear, month, startDay),
        endDate: new Date(currentYear, month, endDay, 23, 59, 59)
      };
    }
    return null;
  };

  const allTournaments = [
    LEAGUE_CONFIG.preDraftTournament,
    ...LEAGUE_CONFIG.season1Tournaments,
    ...LEAGUE_CONFIG.season2Tournaments
  ];

  // If today falls within a tournament's dates, select it
  for (const t of allTournaments) {
    const dates = parseDates(t.dates);
    if (dates && today >= dates.startDate && today <= dates.endDate) {
      return t.id;
    }
  }

  // Otherwise pick the most recently completed tournament
  let mostRecentId = null;
  let mostRecentEnd = null;
  for (const t of allTournaments) {
    const dates = parseDates(t.dates);
    if (dates && today > dates.endDate) {
      if (!mostRecentEnd || dates.endDate > mostRecentEnd) {
        mostRecentId = t.id;
        mostRecentEnd = dates.endDate;
      }
    }
  }
  if (mostRecentId) return mostRecentId;

  // Nothing has started yet – fall back to the first tournament
  return allTournaments[0].id;
};

// Commissioner password (in production, use proper auth)
const COMMISSIONER_PASSWORD = "highline2026";

// Comprehensive PGA Player Database (Top 200+ OWGR + notable players)
const PGA_PLAYERS = [
  // Top 50 OWGR
  { name: "Scottie Scheffler", rank: 1 },
  { name: "Rory McIlroy", rank: 2 },
  { name: "Xander Schauffele", rank: 3 },
  { name: "Tommy Fleetwood", rank: 4 },
  { name: "Russell Henley", rank: 5 },
  { name: "J.J. Spaun", rank: 6 },
  { name: "Robert MacIntyre", rank: 7 },
  { name: "Justin Thomas", rank: 8 },
  { name: "Ben Griffin", rank: 9 },
  { name: "Justin Rose", rank: 10 },
  { name: "Viktor Hovland", rank: 11 },
  { name: "Collin Morikawa", rank: 12 },
  { name: "Harris English", rank: 13 },
  { name: "Keegan Bradley", rank: 14 },
  { name: "Sepp Straka", rank: 15 },
  { name: "Ludvig Åberg", rank: 16 },
  { name: "Alex Noren", rank: 17 },
  { name: "Cameron Young", rank: 18 },
  { name: "Hideki Matsuyama", rank: 19 },
  { name: "Maverick McNealy", rank: 20 },
  { name: "Tyrrell Hatton", rank: 21 },
  { name: "Patrick Cantlay", rank: 22 },
  { name: "Aaron Rai", rank: 23 },
  { name: "Bryson DeChambeau", rank: 24 },
  { name: "Sam Burns", rank: 25 },
  { name: "Shane Lowry", rank: 26 },
  { name: "Chris Gotterup", rank: 27 },
  { name: "Corey Conners", rank: 28 },
  { name: "Marco Penge", rank: 29 },
  { name: "Matt Fitzpatrick", rank: 30 },
  { name: "Max Greyserman", rank: 31 },
  { name: "Brian Harman", rank: 32 },
  { name: "Andrew Novak", rank: 33 },
  { name: "Kurt Kitayama", rank: 34 },
  { name: "Sungjae Im", rank: 35 },
  { name: "Michael Kim", rank: 36 },
  { name: "Wyndham Clark", rank: 37 },
  { name: "Ryan Fox", rank: 38 },
  { name: "Akshay Bhatia", rank: 39 },
  { name: "Michael Brennan", rank: 40 },
  { name: "Billy Horschel", rank: 41 },
  { name: "Rasmus Højgaard", rank: 42 },
  { name: "Taylor Pendrith", rank: 43 },
  { name: "Patrick Reed", rank: 44 },
  { name: "Nick Taylor", rank: 45 },
  { name: "Min Woo Lee", rank: 46 },
  { name: "Jason Day", rank: 47 },
  { name: "Sam Stevens", rank: 48 },
  { name: "Ryan Gerard", rank: 49 },
  { name: "Thomas Detry", rank: 50 },
  // 51-100
  { name: "Matt McCarty", rank: 51 },
  { name: "Johnny Keefer", rank: 52 },
  { name: "Daniel Berger", rank: 53 },
  { name: "Harry Hall", rank: 54 },
  { name: "J.T. Poston", rank: 55 },
  { name: "Kristoffer Reitan", rank: 56 },
  { name: "Lucas Glover", rank: 57 },
  { name: "Nico Echavarria", rank: 58 },
  { name: "Denny McCarthy", rank: 59 },
  { name: "Adam Scott", rank: 60 },
  { name: "Chris Kirk", rank: 61 },
  { name: "Brian Campbell", rank: 62 },
  { name: "Thriston Lawrence", rank: 63 },
  { name: "Si Woo Kim", rank: 64 },
  { name: "Bud Cauley", rank: 65 },
  { name: "Jordan Spieth", rank: 66 },
  { name: "Garrick Higgo", rank: 67 },
  { name: "Matt Wallace", rank: 68 },
  { name: "Jacob Bridgeman", rank: 69 },
  { name: "Nicolai Højgaard", rank: 70 },
  { name: "Laurie Canter", rank: 71 },
  { name: "Aldrich Potgieter", rank: 72 },
  { name: "Michael Thorbjornsen", rank: 73 },
  { name: "Jon Rahm", rank: 74 },
  { name: "Rico Hoey", rank: 75 },
  { name: "Adrien Saddier", rank: 76 },
  { name: "Daniel Brown", rank: 77 },
  { name: "Tony Finau", rank: 78 },
  { name: "Kevin Yu", rank: 79 },
  { name: "Jhonattan Vegas", rank: 80 },
  { name: "Rickie Fowler", rank: 81 },
  { name: "Christiaan Bezuidenhout", rank: 82 },
  { name: "Mackenzie Hughes", rank: 83 },
  { name: "Tom McKibbin", rank: 84 },
  { name: "Byeong Hun An", rank: 85 },
  { name: "Tom Hoge", rank: 86 },
  { name: "Davis Thompson", rank: 87 },
  { name: "Matti Schmid", rank: 88 },
  { name: "Haotong Li", rank: 89 },
  { name: "Jordan Smith", rank: 90 },
  { name: "Neal Shipley", rank: 91 },
  { name: "Jake Knapp", rank: 92 },
  { name: "Tom Kim", rank: 93 },
  { name: "Davis Riley", rank: 94 },
  { name: "Rasmus Neergaard-Petersen", rank: 95 },
  { name: "John Parry", rank: 96 },
  { name: "Sahith Theegala", rank: 97 },
  { name: "Stephan Jaeger", rank: 98 },
  { name: "Emiliano Grillo", rank: 99 },
  { name: "Thorbjørn Olesen", rank: 100 },
  // 101-150
  { name: "Pierceson Coody", rank: 101 },
  { name: "Steven Fisk", rank: 102 },
  { name: "Sami Välimäki", rank: 103 },
  { name: "Mac Meissner", rank: 104 },
  { name: "Keita Nakajima", rank: 105 },
  { name: "Erik van Rooyen", rank: 106 },
  { name: "Joe Highsmith", rank: 107 },
  { name: "Eric Cole", rank: 108 },
  { name: "Austin Eckroat", rank: 109 },
  { name: "Max McGreevy", rank: 110 },
  { name: "William Mouw", rank: 111 },
  { name: "Joakim Lagergren", rank: 112 },
  { name: "Mark Hubbard", rank: 113 },
  { name: "Vince Whaley", rank: 114 },
  { name: "Kazuki Higa", rank: 115 },
  { name: "Chandler Blanchet", rank: 116 },
  { name: "Gary Woodland", rank: 117 },
  { name: "Patrick Rodgers", rank: 118 },
  { name: "Shaun Norris", rank: 119 },
  { name: "Victor Perez", rank: 120 },
  { name: "Beau Hossler", rank: 121 },
  { name: "Cam Davis", rank: 122 },
  { name: "Ryo Hisatsune", rank: 123 },
  { name: "Patrick Fishburn", rank: 124 },
  { name: "Keith Mitchell", rank: 125 },
  { name: "Joaquín Niemann", rank: 126 },
  { name: "Austin Smotherman", rank: 127 },
  { name: "Max Homa", rank: 128 },
  { name: "Matt Kuchar", rank: 129 },
  { name: "Takumi Kanaya", rank: 130 },
  { name: "Angel Ayora", rank: 131 },
  { name: "Martin Couvra", rank: 132 },
  { name: "Nick Dunlap", rank: 133 },
  { name: "Alex Smalley", rank: 134 },
  { name: "David Lipsky", rank: 135 },
  { name: "Elvis Smylie", rank: 136 },
  { name: "Jesper Svensson", rank: 137 },
  { name: "Karl Vilips", rank: 138 },
  { name: "Kevin Roy", rank: 139 },
  { name: "Justin Lower", rank: 140 },
  { name: "Christo Lamprecht", rank: 141 },
  { name: "Andy Sullivan", rank: 142 },
  { name: "Kensei Hirata", rank: 143 },
  { name: "Taylor Moore", rank: 144 },
  { name: "Emilio González", rank: 145 },
  { name: "Eugenio Chacarra", rank: 146 },
  { name: "Niklas Norgaard", rank: 147 },
  { name: "Jorge Campillo", rank: 148 },
  { name: "Adrien Dumont de Chassart", rank: 149 },
  { name: "Richard Mansell", rank: 150 },
  // 151-200
  { name: "Lee Hodges", rank: 151 },
  { name: "Scott Vincent", rank: 152 },
  { name: "Luke Clanton", rank: 153 },
  { name: "Jayden Schaper", rank: 154 },
  { name: "S.H. Kim", rank: 155 },
  { name: "Doug Ghim", rank: 156 },
  { name: "Carlos Ortiz", rank: 157 },
  { name: "JC Ritchie", rank: 158 },
  { name: "Carson Young", rank: 159 },
  { name: "Antoine Rozner", rank: 160 },
  { name: "Ewen Ferguson", rank: 161 },
  { name: "Richard T. Lee", rank: 162 },
  { name: "Chad Ramey", rank: 163 },
  { name: "Grant Forrest", rank: 164 },
  { name: "Daniel Hillier", rank: 165 },
  { name: "David Puig", rank: 166 },
  { name: "Jackson Suber", rank: 167 },
  { name: "Oliver Lindell", rank: 168 },
  { name: "Matthieu Pavon", rank: 169 },
  { name: "Joost Luiten", rank: 170 },
  { name: "Taehoon Ok", rank: 171 },
  { name: "Trace Crowe", rank: 172 },
  { name: "Andrew Putnam", rank: 173 },
  { name: "Matthew Jordan", rank: 174 },
  { name: "Jacob Skov Olesen", rank: 175 },
  { name: "Jacques Kruyswijk", rank: 176 },
  { name: "Jackson Koivun", rank: 177 },
  { name: "Lanto Griffin", rank: 178 },
  { name: "Romain Langasque", rank: 179 },
  { name: "Taylor Montgomery", rank: 180 },
  { name: "Will Zalatoris", rank: 181 },
  { name: "Séamus Power", rank: 182 },
  { name: "Peter Uihlein", rank: 183 },
  { name: "Harry Higgs", rank: 184 },
  { name: "Calum Hill", rank: 185 },
  { name: "Hank Lebioda", rank: 186 },
  { name: "Kazuma Kobori", rank: 187 },
  { name: "Matteo Manassero", rank: 188 },
  { name: "Nacho Elvira", rank: 189 },
  { name: "Danny Walker", rank: 190 },
  { name: "Nicolai von Dellingshausen", rank: 191 },
  { name: "Joel Dahmen", rank: 192 },
  { name: "David Law", rank: 193 },
  { name: "Lee Jung-hwan", rank: 194 },
  { name: "Hayden Springer", rank: 195 },
  { name: "Jeffrey Kang", rank: 196 },
  { name: "Sam Ryder", rank: 197 },
  { name: "Todd Clements", rank: 198 },
  { name: "Isaiah Salinda", rank: 199 },
  { name: "Zach Bauchou", rank: 200 },
  // Additional notable players (LIV, veterans, etc.)
  { name: "Brooks Koepka", rank: 201 },
  { name: "Dustin Johnson", rank: 202 },
  { name: "Phil Mickelson", rank: 203 },
  { name: "Cameron Smith", rank: 204 },
  { name: "Sergio Garcia", rank: 205 },
  { name: "Ian Poulter", rank: 206 },
  { name: "Lee Westwood", rank: 207 },
  { name: "Tiger Woods", rank: 208 },
  { name: "Bubba Watson", rank: 209 },
  { name: "Abraham Ancer", rank: 210 },
  { name: "Jason Kokrak", rank: 211 },
  { name: "Kevin Na", rank: 212 },
  { name: "Talor Gooch", rank: 213 },
  { name: "Harold Varner III", rank: 214 },
  { name: "Brendan Steele", rank: 215 },
  { name: "Webb Simpson", rank: 216 },
  { name: "Zach Johnson", rank: 217 },
  { name: "Kevin Kisner", rank: 218 },
  { name: "Charles Howell III", rank: 219 },
  { name: "Martin Kaymer", rank: 220 },
  { name: "Louis Oosthuizen", rank: 221 },
  { name: "Graeme McDowell", rank: 222 },
  { name: "Henrik Stenson", rank: 223 },
  { name: "Paul Casey", rank: 224 },
  { name: "Francesco Molinari", rank: 225 },
  { name: "Charl Schwartzel", rank: 226 },
  { name: "Branden Grace", rank: 227 },
  { name: "Adrian Meronk", rank: 228 },
  { name: "Dean Burmester", rank: 229 },
  { name: "Thomas Pieters", rank: 230 },
  { name: "Sebastian Munoz", rank: 231 },
  { name: "Lucas Herbert", rank: 232 },
  { name: "Luke List", rank: 233 },
  { name: "Alex Cejka", rank: 234 },
  { name: "Troy Merritt", rank: 235 },
  { name: "Kelly Kraft", rank: 236 },
  { name: "Wes Roach", rank: 237 },
  { name: "Ben Martin", rank: 238 },
  { name: "Dylan Wu", rank: 239 },
  { name: "Callum Tarren", rank: 240 },
];

// ESPN API helper
const fetchESPNLeaderboard = async () => {
  try {
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching ESPN data:', error);
    return null;
  }
};

// Storage keys
const STORAGE_KEYS = {
  ROSTERS: 'highline-rosters',
  LINEUPS: 'highline-lineups',
  DRAFT_RESULTS: 'highline-draft',
  TOURNAMENT_RESULTS: 'highline-tournament-results',
  RENTALS: 'highline-rentals',
  PREDRAFT_LINEUPS: 'highline-predraft-lineups'
};

// Styles
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  
  :root {
    --bg-primary: #0a0f0d;
    --bg-secondary: #111916;
    --bg-tertiary: #1a2420;
    --bg-card: #151d19;
    --accent-green: #00ff87;
    --accent-green-dim: #00cc6a;
    --accent-gold: #ffd700;
    --accent-red: #ff4757;
    --accent-blue: #00d4ff;
    --accent-orange: #ff9f43;
    --text-primary: #ffffff;
    --text-secondary: #a0b0a8;
    --text-muted: #5a6a62;
    --border-color: #2a3a32;
    --gradient-green: linear-gradient(135deg, #00ff87 0%, #00cc6a 100%);
    --gradient-gold: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
    --gradient-orange: linear-gradient(135deg, #ff9f43 0%, #ff6b35 100%);
    --shadow-glow: 0 0 40px rgba(0, 255, 135, 0.15);
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Outfit', sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
  }

  .app-container {
    min-height: 100vh;
    background: 
      radial-gradient(ellipse at 20% 0%, rgba(0, 255, 135, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 100%, rgba(0, 212, 255, 0.05) 0%, transparent 50%),
      var(--bg-primary);
  }

  .header {
    padding: 24px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    background: rgba(10, 15, 13, 0.8);
    backdrop-filter: blur(20px);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .logo-icon {
    width: 48px;
    height: 48px;
    background: var(--gradient-green);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    box-shadow: var(--shadow-glow);
  }

  .logo-text {
    font-weight: 700;
    font-size: 22px;
    letter-spacing: -0.5px;
  }

  .logo-text span {
    color: var(--accent-green);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .nav-tabs {
    display: flex;
    gap: 8px;
    background: var(--bg-tertiary);
    padding: 6px;
    border-radius: 12px;
  }

  .nav-tab {
    padding: 12px 24px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .nav-tab:hover {
    color: var(--text-primary);
    background: var(--bg-card);
  }

  .nav-tab.active {
    background: var(--accent-green);
    color: var(--bg-primary);
    font-weight: 600;
  }

  .nav-tab.commissioner {
    background: var(--gradient-orange);
    color: var(--bg-primary);
  }

  .live-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(0, 255, 135, 0.1);
    border: 1px solid rgba(0, 255, 135, 0.3);
    border-radius: 20px;
    font-size: 13px;
    color: var(--accent-green);
    font-weight: 500;
  }

  .commissioner-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 159, 67, 0.1);
    border: 1px solid rgba(255, 159, 67, 0.3);
    border-radius: 20px;
    font-size: 13px;
    color: var(--accent-orange);
    font-weight: 500;
    cursor: pointer;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    background: var(--accent-green);
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }

  .main-content {
    padding: 32px 40px;
    max-width: 1600px;
    margin: 0 auto;
  }

  .tournament-header {
    margin-bottom: 32px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .tournament-info h1 {
    font-size: 36px;
    font-weight: 700;
    letter-spacing: -1px;
    margin-bottom: 8px;
  }

  .tournament-selector {
    margin-bottom: 12px;
  }

  .tournament-dropdown {
    padding: 12px 20px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    color: var(--text-primary);
    font-family: 'Outfit', sans-serif;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    min-width: 400px;
    outline: none;
  }

  .tournament-dropdown:focus {
    border-color: var(--accent-green);
  }

  .tournament-dropdown option {
    background: var(--bg-secondary);
    padding: 8px;
  }

  .tournament-dropdown optgroup {
    font-weight: 600;
    color: var(--accent-green);
  }

  .tournament-meta {
    display: flex;
    gap: 24px;
    color: var(--text-secondary);
    font-size: 15px;
  }

  .tournament-meta span {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-upcoming {
    color: var(--accent-orange) !important;
  }

  .status-final {
    color: var(--accent-green) !important;
  }

  .major-badge {
    color: var(--accent-gold) !important;
    font-weight: 600;
  }

  .upcoming-tournament {
    text-align: center;
    padding: 80px 40px;
    background: var(--bg-card);
    border-radius: 16px;
    border: 1px solid var(--border-color);
  }

  .upcoming-icon {
    font-size: 64px;
    margin-bottom: 24px;
  }

  .upcoming-tournament h2 {
    font-size: 28px;
    margin-bottom: 12px;
  }

  .upcoming-tournament p {
    color: var(--text-secondary);
    font-size: 16px;
  }

  .final-results {
    padding: 40px;
    background: var(--bg-card);
    border-radius: 16px;
    border: 1px solid var(--border-color);
  }

  .final-results h2 {
    font-size: 24px;
    margin-bottom: 16px;
  }

  .predraft-badge {
    color: var(--accent-blue) !important;
    font-weight: 500;
  }

  .refresh-btn {
    padding: 12px 24px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    color: var(--text-primary);
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .refresh-btn:hover {
    background: var(--bg-card);
    border-color: var(--accent-green);
  }

  /* Horizontal Team Scoreboard */
  .team-scoreboard {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 24px;
  }

  .scoreboard-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .scoreboard-title {
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .bonus-badge {
    padding: 4px 10px;
    background: rgba(0, 255, 135, 0.15);
    border: 1px solid rgba(0, 255, 135, 0.3);
    border-radius: 6px;
    font-size: 11px;
    color: var(--accent-green);
    font-weight: 500;
  }

  .bonus-toggle {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .bonus-toggle.active {
    background: rgba(0, 255, 135, 0.15);
    border: 1px solid rgba(0, 255, 135, 0.3);
    color: var(--accent-green);
  }

  .bonus-toggle.inactive {
    background: rgba(255, 71, 87, 0.1);
    border: 1px solid rgba(255, 71, 87, 0.3);
    color: var(--accent-red);
    text-decoration: line-through;
  }

  .bonus-toggle:hover {
    opacity: 0.8;
  }

  .round-badge {
    padding: 4px 10px;
    background: rgba(0, 212, 255, 0.15);
    border: 1px solid rgba(0, 212, 255, 0.3);
    border-radius: 6px;
    font-size: 11px;
    color: var(--accent-blue);
    font-weight: 500;
  }

  .cut-line-badge {
    padding: 4px 10px;
    background: rgba(255, 159, 67, 0.15);
    border: 1px solid rgba(255, 159, 67, 0.3);
    border-radius: 6px;
    font-size: 11px;
    color: var(--accent-orange);
    font-weight: 500;
  }

  .mc-penalty-badge {
    padding: 4px 10px;
    background: rgba(255, 71, 87, 0.15);
    border: 1px solid rgba(255, 71, 87, 0.3);
    border-radius: 6px;
    font-size: 11px;
    color: var(--accent-red);
    font-weight: 500;
  }

  .scoreboard-grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 1px;
    background: var(--border-color);
  }

  .scoreboard-team {
    background: var(--bg-card);
    padding: 12px;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .scoreboard-team.leading {
    background: linear-gradient(180deg, rgba(0, 255, 135, 0.1) 0%, var(--bg-card) 100%);
  }

  .scoreboard-team-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 10px;
  }

  .scoreboard-rank {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .scoreboard-team.leading .scoreboard-rank {
    background: var(--accent-gold);
    color: var(--bg-primary);
  }

  .scoreboard-team-name {
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .leader-badge {
    font-size: 12px;
  }

  .scoreboard-team-total {
    font-family: 'JetBrains Mono', monospace;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .scoreboard-team-total.under-par {
    color: var(--accent-green);
  }

  .scoreboard-team-total.over-par {
    color: var(--accent-red);
  }

  .scoreboard-players {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .scoreboard-player {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px;
    background: var(--bg-tertiary);
    border-radius: 6px;
    font-size: 12px;
  }

  .scoreboard-player.penalty {
    background: rgba(255, 71, 87, 0.1);
    border: 1px solid rgba(255, 71, 87, 0.2);
  }

  .scoreboard-player.leader {
    background: rgba(255, 215, 0, 0.1);
    border: 1px solid rgba(255, 215, 0, 0.3);
  }

  .scoreboard-player.rental {
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.2);
  }

  .scoreboard-player-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-badge {
    font-size: 9px;
    padding: 1px 4px;
    background: var(--accent-red);
    color: white;
    border-radius: 3px;
    font-weight: 600;
  }

  .rental-badge {
    font-size: 9px;
    padding: 1px 4px;
    background: var(--accent-blue);
    color: var(--bg-primary);
    border-radius: 3px;
    font-weight: 600;
  }

  .bonus-indicator {
    font-size: 11px;
    margin-left: 2px;
  }

  .scoreboard-player-score {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    font-size: 12px;
  }

  .scoreboard-player-score.under-par {
    color: var(--accent-green);
  }

  .scoreboard-player-score.over-par {
    color: var(--accent-red);
  }

  .no-starters {
    color: var(--text-muted);
    font-size: 11px;
    text-align: center;
    padding: 12px 0;
    font-style: italic;
  }

  .scoreboard-bonus {
    margin-top: 8px;
    padding: 6px;
    background: rgba(255, 215, 0, 0.1);
    border: 1px solid rgba(255, 215, 0, 0.3);
    border-radius: 6px;
    font-size: 10px;
    color: var(--accent-gold);
    text-align: center;
    font-weight: 500;
  }

  @media (max-width: 1400px) {
    .scoreboard-grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  @media (max-width: 900px) {
    .scoreboard-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .grid-2col {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 24px;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    overflow: hidden;
  }

  .card.commissioner-card {
    border-color: rgba(255, 159, 67, 0.3);
  }

  .card-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-header.commissioner-header {
    background: rgba(255, 159, 67, 0.1);
  }

  .card-title {
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .card-badge {
    padding: 4px 10px;
    background: var(--bg-tertiary);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
  }

  .leaderboard-table th {
    padding: 14px 20px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    background: var(--bg-secondary);
  }

  .leaderboard-table th:first-child {
    padding-left: 24px;
  }

  .leaderboard-table td {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    font-size: 14px;
  }

  .leaderboard-table td:first-child {
    padding-left: 24px;
  }

  .leaderboard-table tr:last-child td {
    border-bottom: none;
  }

  .leaderboard-table tr:hover {
    background: var(--bg-tertiary);
  }

  .rank {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--text-muted);
    width: 40px;
  }

  .rank.top-3 {
    color: var(--accent-gold);
  }

  .player-name {
    font-weight: 500;
  }

  .player-team {
    font-size: 12px;
    color: var(--accent-green);
    margin-top: 2px;
  }

  .score {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    font-size: 15px;
  }

  .score.under-par {
    color: var(--accent-green);
  }

  .score.over-par {
    color: var(--accent-red);
  }

  .score.even-par {
    color: var(--text-secondary);
  }

  .round-scores {
    display: flex;
    gap: 8px;
  }

  .round-score {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    color: var(--text-secondary);
  }

  .thru {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: var(--text-muted);
  }

  .team-standings {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 24px;
  }

  .team-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: var(--bg-tertiary);
    border-radius: 12px;
    border: 1px solid transparent;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .team-card:hover {
    border-color: var(--accent-green);
    transform: translateX(4px);
  }

  .team-card.leading {
    background: linear-gradient(135deg, rgba(0, 255, 135, 0.15) 0%, rgba(0, 255, 135, 0.05) 100%);
    border-color: rgba(0, 255, 135, 0.3);
  }

  .team-rank {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-muted);
    width: 32px;
  }

  .team-card.leading .team-rank {
    color: var(--accent-gold);
  }

  .team-details {
    flex: 1;
    margin-left: 12px;
  }

  .team-name {
    font-weight: 600;
    font-size: 15px;
  }

  .team-players {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .team-score {
    text-align: right;
  }

  .team-total {
    font-family: 'JetBrains Mono', monospace;
    font-size: 20px;
    font-weight: 700;
  }

  .team-total.under-par {
    color: var(--accent-green);
  }

  .team-points {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  /* Commissioner Styles */
  .commissioner-panel {
    padding: 24px;
  }

  .commissioner-section {
    margin-bottom: 32px;
  }

  .commissioner-section h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 16px;
    color: var(--accent-orange);
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .form-select, .form-input {
    width: 100%;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    color: var(--text-primary);
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .form-select:focus, .form-input:focus {
    border-color: var(--accent-orange);
  }

  .form-select option {
    background: var(--bg-secondary);
  }

  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 10px;
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: var(--gradient-green);
    color: var(--bg-primary);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 255, 135, 0.3);
  }

  .btn-orange {
    background: var(--gradient-orange);
    color: var(--bg-primary);
  }

  .btn-orange:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(255, 159, 67, 0.3);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    border-color: var(--accent-green);
  }

  .btn-sm {
    padding: 8px 16px;
    font-size: 12px;
  }

  .btn-danger {
    background: var(--accent-red);
    color: white;
  }

  .roster-editor {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .roster-list {
    background: var(--bg-tertiary);
    border-radius: 12px;
    padding: 16px;
  }

  .roster-list h4 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--text-secondary);
  }

  .roster-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: var(--bg-card);
    border-radius: 8px;
    margin-bottom: 8px;
    border: 1px solid var(--border-color);
  }

  .roster-item.starter {
    border-color: var(--accent-green);
    background: rgba(0, 255, 135, 0.05);
  }

  .roster-item-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .roster-item-round {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-secondary);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .roster-item-name {
    font-weight: 500;
    font-size: 14px;
  }

  .roster-item-actions {
    display: flex;
    gap: 8px;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .icon-btn:hover {
    background: var(--accent-green);
    color: var(--bg-primary);
  }

  .icon-btn.active {
    background: var(--accent-green);
    color: var(--bg-primary);
  }

  .icon-btn.remove:hover {
    background: var(--accent-red);
  }

  .player-search-results {
    max-height: 300px;
    overflow-y: auto;
    background: var(--bg-tertiary);
    border-radius: 12px;
    margin-top: 8px;
  }

  .player-search-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .player-search-item:hover {
    background: var(--bg-card);
  }

  .player-search-item:last-child {
    border-bottom: none;
  }

  .draft-entry-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
  }

  .draft-round-col {
    background: var(--bg-tertiary);
    border-radius: 12px;
    padding: 12px;
  }

  .draft-round-header {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-align: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .draft-pick-entry {
    margin-bottom: 8px;
  }

  .draft-pick-label {
    font-size: 10px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .draft-pick-input {
    width: 100%;
    padding: 8px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-family: 'Outfit', sans-serif;
    font-size: 12px;
  }

  .draft-pick-input:focus {
    border-color: var(--accent-orange);
    outline: none;
  }

  .lineup-editor {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .lineup-team-card {
    background: var(--bg-tertiary);
    border-radius: 12px;
    padding: 16px;
    border: 1px solid var(--border-color);
  }

  .lineup-team-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .lineup-team-name {
    font-weight: 600;
    font-size: 15px;
  }

  .lineup-count {
    font-size: 12px;
    color: var(--accent-green);
  }

  .lineup-player {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
  }

  .lineup-checkbox {
    width: 18px;
    height: 18px;
    accent-color: var(--accent-green);
    cursor: pointer;
  }

  .lineup-player-name {
    font-size: 14px;
  }

  .lineup-player-name.starter {
    color: var(--accent-green);
    font-weight: 500;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 32px;
    max-width: 400px;
    width: 90%;
  }

  .modal h2 {
    font-size: 20px;
    margin-bottom: 8px;
  }

  .modal p {
    color: var(--text-secondary);
    font-size: 14px;
    margin-bottom: 24px;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  /* Roster Management */
  .roster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }

  .roster-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    overflow: hidden;
  }

  .roster-header {
    padding: 16px 20px;
    background: var(--bg-tertiary);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .roster-team-name {
    font-weight: 600;
    font-size: 16px;
  }

  .roster-status {
    font-size: 12px;
    color: var(--accent-green);
    font-weight: 500;
  }

  .roster-players {
    padding: 16px 20px;
  }

  .roster-player {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-color);
  }

  .roster-player:last-child {
    border-bottom: none;
  }

  .roster-player-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .starter-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
  }

  .starter-indicator.active {
    background: var(--accent-green);
    box-shadow: 0 0 8px rgba(0, 255, 135, 0.5);
  }

  .roster-player-name {
    font-weight: 500;
    font-size: 14px;
  }

  .roster-player-round {
    font-size: 11px;
    color: var(--text-muted);
  }

  .roster-player-score {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
  }

  /* Standings Page */
  .standings-table {
    width: 100%;
    border-collapse: collapse;
  }

  .standings-table th {
    padding: 16px 20px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    background: var(--bg-secondary);
  }

  .standings-table td {
    padding: 18px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .standings-table tr:hover {
    background: var(--bg-tertiary);
  }

  .season-toggle {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
  }

  .season-btn {
    padding: 10px 20px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-secondary);
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .season-btn.active {
    background: var(--accent-green);
    color: var(--bg-primary);
    border-color: var(--accent-green);
  }

  /* Loading State */
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px;
    color: var(--text-secondary);
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--border-color);
    border-top-color: var(--accent-green);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 60px 40px;
    color: var(--text-secondary);
  }

  .empty-state h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text-primary);
  }

  /* Success/Error Messages */
  .message {
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 14px;
  }

  .message.success {
    background: rgba(0, 255, 135, 0.1);
    border: 1px solid rgba(0, 255, 135, 0.3);
    color: var(--accent-green);
  }

  .message.error {
    background: rgba(255, 71, 87, 0.1);
    border: 1px solid rgba(255, 71, 87, 0.3);
    color: var(--accent-red);
  }

  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--bg-secondary);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }

  /* Responsive */
  @media (max-width: 1200px) {
    .grid-2col {
      grid-template-columns: 1fr;
    }
    
    .roster-editor {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .header {
      padding: 16px 20px;
      flex-direction: column;
      gap: 16px;
    }

    .main-content {
      padding: 20px;
    }

    .nav-tabs {
      width: 100%;
      overflow-x: auto;
    }

    .draft-entry-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`;

// Main App Component
export default function HighlineFantasyGolf() {
  const [activeTab, setActiveTab] = useState('live');
  const [espnData, setEspnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Commissioner state
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [message, setMessage] = useState(null);
  
  // Data state (persisted)
  const [rosters, setRosters] = useState({});
  const [lineups, setLineups] = useState({});
  const [selectedTournament, setSelectedTournament] = useState('s1t1');
  const [selectedTeamForEdit, setSelectedTeamForEdit] = useState(1);
  const [tournamentResults, setTournamentResults] = useState({});
  const [rentals, setRentals] = useState({});
  const [preDraftLineups, setPreDraftLineups] = useState({});
  
  // Live scoring tournament selection
  const [liveTournamentId, setLiveTournamentId] = useState(getDefaultTournamentId);
  const [rentalSearchQuery, setRentalSearchQuery] = useState('');
  const [selectedTeamForRental, setSelectedTeamForRental] = useState(1);
  const [preDraftSearchQuery, setPreDraftSearchQuery] = useState('');
  const [selectedTeamForPreDraft, setSelectedTeamForPreDraft] = useState(1);
  const [bonusEnabled, setBonusEnabled] = useState(true); // Toggle for -10 winner bonus

  // Get all tournaments with status
  const getAllTournaments = () => {
    // Include pre-draft tournament at the beginning
    const preDraft = {
      ...LEAGUE_CONFIG.preDraftTournament,
      season: 0, // Special season for pre-draft
      isPreDraft: true
    };
    
    const all = [
      preDraft,
      ...LEAGUE_CONFIG.season1Tournaments.map(t => ({ ...t, season: 1 })),
      ...LEAGUE_CONFIG.season2Tournaments.map(t => ({ ...t, season: 2 }))
    ];
    
    // For date comparison, we need to handle the ESPN timeline
    const espnEvent = espnData?.events?.[0];
    const espnEventName = espnEvent?.name?.toLowerCase() || '';
    const espnState = espnEvent?.status?.type?.state || '';  // "in", "pre", or "post"
    
    // Use the league config year for parsing our tournament dates
    const currentYear = LEAGUE_CONFIG.year || 2026;
    
    // Use real current date
    const today = new Date();
    
    // Debug logging (can remove later)
    console.log('Today:', today);
    console.log('ESPN Event:', espnEventName);
    console.log('ESPN State:', espnState);
    
    // Month name to number mapping
    const monthMap = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    
    // Parse tournament dates (format: "Feb 5-8" or "Apr 9-12" or "Jan 29-Feb 1")
    const parseTournamentDates = (dateStr) => {
      // First try: cross-month format like "Jan 29-Feb 1"
      const crossMonthMatch = dateStr.match(/([A-Za-z]+)\s+(\d+)-([A-Za-z]+)\s+(\d+)/);
      if (crossMonthMatch) {
        const startMonthName = crossMonthMatch[1].toLowerCase().substring(0, 3);
        const startDay = parseInt(crossMonthMatch[2]);
        const endMonthName = crossMonthMatch[3].toLowerCase().substring(0, 3);
        const endDay = parseInt(crossMonthMatch[4]);
        const startMonth = monthMap[startMonthName];
        const endMonth = monthMap[endMonthName];
        
        if (startMonth === undefined || endMonth === undefined) return null;
        
        const startDate = new Date(currentYear, startMonth, startDay);
        const endDate = new Date(currentYear, endMonth, endDay, 23, 59, 59);
        
        return { startDate, endDate };
      }
      
      // Second try: same-month format like "Feb 5-8"
      const sameMonthMatch = dateStr.match(/([A-Za-z]+)\s+(\d+)-(\d+)/);
      if (sameMonthMatch) {
        const monthName = sameMonthMatch[1].toLowerCase().substring(0, 3);
        const startDay = parseInt(sameMonthMatch[2]);
        const endDay = parseInt(sameMonthMatch[3]);
        const month = monthMap[monthName];
        
        if (month === undefined) return null;
        
        const startDate = new Date(currentYear, month, startDay);
        const endDate = new Date(currentYear, month, endDay, 23, 59, 59); // End of day
        
        return { startDate, endDate };
      }
      
      return null;
    };
    
    return all.map(t => {
      // Check if we have saved results for this tournament
      const hasResults = tournamentResults[t.id]?.final;
      
      if (hasResults) {
        return { ...t, status: 'final' };
      }
      
      // Parse the tournament dates
      const dates = parseTournamentDates(t.dates);
      if (!dates) {
        return { ...t, status: 'upcoming' };
      }
      
      const { startDate, endDate } = dates;
      
      // Check if tournament is in the past (ended before today)
      if (today > endDate) {
        return { ...t, status: 'final' };
      }
      
      // Check if tournament is in the future (starts after today)
      if (today < startDate) {
        return { ...t, status: 'upcoming' };
      }
      
      // Tournament dates overlap with today - check if ESPN is showing this tournament
      // Match by checking if tournament names have common keywords
      const tournamentKeywords = t.name.toLowerCase().split(' ').filter(w => w.length > 3);
      const isMatchingESPN = tournamentKeywords.some(keyword => 
        espnEventName.includes(keyword)
      ) || espnEventName.split(' ').filter(w => w.length > 3).some(keyword =>
        t.name.toLowerCase().includes(keyword)
      );
      
      if (isMatchingESPN && espnState === 'in') {
        return { ...t, status: 'live' };
      }
      
      // We're within the tournament date range but ESPN isn't showing it as live
      // This could mean it just ended or is about to start
      if (today >= startDate && today <= endDate) {
        // Check ESPN status
        if (espnState === 'post') {
          return { ...t, status: 'final' };
        }
        return { ...t, status: 'live' };
      }
      
      return { ...t, status: 'upcoming' };
    });
  };

  // Load data from Firebase with real-time listeners
  useEffect(() => {
    // Initialize empty rosters first
    const initialRosters = {};
    LEAGUE_CONFIG.teams.forEach(team => {
      initialRosters[team.id] = { players: [] };
    });

    // Set up real-time listeners for each data type
    const rostersRef = ref(database, 'rosters');
    const lineupsRef = ref(database, 'lineups');
    const resultsRef = ref(database, 'tournamentResults');
    const rentalsRef = ref(database, 'rentals');
    const preDraftRef = ref(database, 'preDraftLineups');

    const unsubscribeRosters = onValue(rostersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRosters(data);
      } else {
        setRosters(initialRosters);
      }
    });

    const unsubscribeLineups = onValue(lineupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLineups(data);
      }
    });

    const unsubscribeResults = onValue(resultsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTournamentResults(data);
      }
    });

    const unsubscribeRentals = onValue(rentalsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRentals(data);
      }
    });

    const unsubscribePreDraft = onValue(preDraftRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPreDraftLineups(data);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribeRosters();
      unsubscribeLineups();
      unsubscribeResults();
      unsubscribeRentals();
      unsubscribePreDraft();
    };
  }, []);

  // Save data to Firebase
  const saveRosters = (newRosters) => {
    setRosters(newRosters);
    set(ref(database, 'rosters'), newRosters);
  };

  const savePreDraftLineups = (newLineups) => {
    setPreDraftLineups(newLineups);
    set(ref(database, 'preDraftLineups'), newLineups);
  };

  const saveLineups = (newLineups) => {
    setLineups(newLineups);
    set(ref(database, 'lineups'), newLineups);
  };

  const saveTournamentResults = (newResults) => {
    setTournamentResults(newResults);
    set(ref(database, 'tournamentResults'), newResults);
  };

  const saveRentals = (newRentals) => {
    setRentals(newRentals);
    set(ref(database, 'rentals'), newRentals);
  };

  // Add rental player to lineup
  const addRentalPlayer = (tournamentId, teamId, playerName) => {
    const newRentals = { ...rentals };
    if (!newRentals[tournamentId]) {
      newRentals[tournamentId] = {};
    }
    if (!newRentals[tournamentId][teamId]) {
      newRentals[tournamentId][teamId] = [];
    }
    
    // Check if already a rental for this team this tournament
    if (newRentals[tournamentId][teamId].includes(playerName)) {
      showMessage('Player already a rental for this team', 'error');
      return;
    }
    
    newRentals[tournamentId][teamId].push(playerName);
    saveRentals(newRentals);
    
    // Also add to lineup as starter
    const newLineups = { ...lineups };
    if (!newLineups[tournamentId]) {
      newLineups[tournamentId] = {};
    }
    if (!newLineups[tournamentId][teamId]) {
      newLineups[tournamentId][teamId] = [];
    }
    if (!newLineups[tournamentId][teamId].includes(playerName)) {
      newLineups[tournamentId][teamId].push(playerName);
      saveLineups(newLineups);
    }
    
    showMessage(`${playerName} added as rental for ${LEAGUE_CONFIG.teams.find(t => t.id === teamId)?.name}`, 'success');
  };

  // Remove rental player
  const removeRentalPlayer = (tournamentId, teamId, playerName) => {
    const newRentals = { ...rentals };
    if (newRentals[tournamentId]?.[teamId]) {
      newRentals[tournamentId][teamId] = newRentals[tournamentId][teamId].filter(
        p => p.toLowerCase() !== playerName.toLowerCase()
      );
      saveRentals(newRentals);
    }
    
    // Also remove from lineup
    const newLineups = { ...lineups };
    if (newLineups[tournamentId]?.[teamId]) {
      newLineups[tournamentId][teamId] = newLineups[tournamentId][teamId].filter(
        p => p.toLowerCase() !== playerName.toLowerCase()
      );
      saveLineups(newLineups);
    }
    
    showMessage(`${playerName} removed as rental`, 'success');
  };

  // Get rentals for a team for a tournament
  const getTeamRentals = (tournamentId, teamId) => {
    return rentals[tournamentId]?.[teamId] || [];
  };

  // Pre-Draft Tournament Functions
  const getPreDraftStarters = (teamId) => {
    return preDraftLineups[teamId] || [];
  };

  const addPreDraftPlayer = (teamId, playerName) => {
    const currentLineup = getPreDraftStarters(teamId);
    
    if (currentLineup.length >= LEAGUE_CONFIG.preDraftStarters) {
      showMessage(`Maximum ${LEAGUE_CONFIG.preDraftStarters} starters for pre-draft`, 'error');
      return;
    }
    
    if (currentLineup.some(p => p.toLowerCase() === playerName.toLowerCase())) {
      showMessage('Player already in lineup', 'error');
      return;
    }
    
    const newLineups = { ...preDraftLineups };
    newLineups[teamId] = [...currentLineup, playerName];
    savePreDraftLineups(newLineups);
    showMessage(`${playerName} added to ${LEAGUE_CONFIG.teams.find(t => t.id === teamId)?.name}'s pre-draft lineup`, 'success');
  };

  const removePreDraftPlayer = (teamId, playerName) => {
    const newLineups = { ...preDraftLineups };
    newLineups[teamId] = (newLineups[teamId] || []).filter(
      p => p.toLowerCase() !== playerName.toLowerCase()
    );
    savePreDraftLineups(newLineups);
    showMessage(`${playerName} removed from pre-draft lineup`, 'success');
  };

  // Calculate pre-draft standings (uses same scoring logic as regular tournaments)
  const calculatePreDraftStandings = () => {
    const leaderboard = getLeaderboard();
    
    // Check if winner bonus is active (Round 3 or later AND toggle is enabled)
    const winnerBonusActive = isRound3OrLater() && bonusEnabled;
    const leaders = winnerBonusActive ? getLeaders() : [];
    
    // Calculate penalty scores for MC/WD/DQ
    // Get all pre-draft starters across all teams
    const allPreDraftStarters = LEAGUE_CONFIG.teams.flatMap(team => {
      const starters = getPreDraftStarters(team.id);
      return starters.map(name => {
        const player = leaderboard.find(p => p.name.toLowerCase() === name.toLowerCase());
        return player;
      }).filter(Boolean);
    });
    
    // For MC penalty: worst weekend score of any player who made the cut
    const cutMakersWithWeekendScores = leaderboard.filter(p => p.madeCut && p.weekendScore !== null);
    const worstWeekendScore = cutMakersWithWeekendScores.length > 0
      ? Math.max(...cutMakersWithWeekendScores.map(p => p.weekendScore))
      : 0;
    
    // For WD/DQ before cut: worst score of any non-WD/DQ pre-draft starter
    const nonWDDQStarters = allPreDraftStarters.filter(p => !p.isWD && !p.isDQ);
    const worstStarterScore = nonWDDQStarters.length > 0
      ? Math.max(...nonWDDQStarters.map(p => p.scoreNum))
      : 0;
    
    // For WD/DQ after cut: worst score of any non-WD/DQ pre-draft starter who made cut
    const nonWDDQStartersWhoCut = nonWDDQStarters.filter(p => p.madeCut);
    const worstStarterScoreAfterCut = nonWDDQStartersWhoCut.length > 0
      ? Math.max(...nonWDDQStartersWhoCut.map(p => p.scoreNum))
      : 0;
    
    // Check if cut has happened
    const cutHasHappened = leaderboard.some(p => p.isCut || p.cutHasHappened);
    
    const standings = LEAGUE_CONFIG.teams.map(team => {
      const starters = getPreDraftStarters(team.id);
      let totalScore = 0;
      let starterScores = [];
      let hasLeader = false;
      let penalties = [];

      starters.forEach(playerName => {
        const player = leaderboard.find(p => 
          p.name.toLowerCase() === playerName.toLowerCase()
        );
        if (player) {
          let playerScore = player.scoreNum;
          let penaltyApplied = null;
          
          // Apply MC penalty: worst weekend score
          if (player.isCut && cutHasHappened) {
            const mcPenalty = worstWeekendScore;
            playerScore = player.scoreNum + mcPenalty;
            penaltyApplied = { type: 'MC', penalty: mcPenalty };
          }
          // Apply WD/DQ penalty
          else if (player.isWD || player.isDQ) {
            if (player.madeCut || (cutHasHappened && player.roundScores && player.roundScores[2] !== null)) {
              // WD/DQ after cut
              playerScore = worstStarterScoreAfterCut;
              penaltyApplied = { type: player.isWD ? 'WD' : 'DQ', penalty: worstStarterScoreAfterCut, afterCut: true };
            } else {
              // WD/DQ before cut
              playerScore = worstStarterScore;
              penaltyApplied = { type: player.isWD ? 'WD' : 'DQ', penalty: worstStarterScore, afterCut: false };
            }
          }
          
          totalScore += playerScore;
          
          const displayScore = playerScore === 0 ? 'E' : (playerScore < 0 ? playerScore : `+${playerScore}`);
          starterScores.push({ 
            name: playerName, 
            score: penaltyApplied ? displayScore : player.score,
            originalScore: player.score,
            scoreNum: playerScore,
            rank: player.rank,
            thru: player.thru,
            isCut: player.isCut,
            isWD: player.isWD,
            isDQ: player.isDQ,
            penaltyApplied
          });
          
          // Check if this starter is a leader (only if not MC/WD/DQ)
          if (!player.isCut && !player.isWD && !player.isDQ && leaders.includes(playerName.toLowerCase())) {
            hasLeader = true;
          }
          
          if (penaltyApplied) {
            penalties.push({ player: playerName, ...penaltyApplied });
          }
        } else {
          // Player not in leaderboard (might not be in the field)
          starterScores.push({
            name: playerName,
            score: '-',
            scoreNum: 0,
            rank: '-',
            thru: 'N/A',
            notInField: true
          });
        }
      });

      // Apply -10 winner bonus if team has a starter in 1st place
      const winnerBonus = hasLeader ? -10 : 0;
      const adjustedScore = totalScore + winnerBonus;

      return {
        ...team,
        totalScore: adjustedScore,
        rawScore: totalScore,
        winnerBonus,
        hasLeader,
        displayScore: starterScores.some(s => s.notInField) 
          ? '-' 
          : (adjustedScore === 0 ? 'E' : (adjustedScore < 0 ? adjustedScore : `+${adjustedScore}`)),
        starters: starterScores,
        starterCount: starters.length,
        penalties
      };
    });

    // Sort by score (lowest first), teams without full lineups go to bottom
    return standings.sort((a, b) => {
      // Teams without full lineups go to the bottom
      if (a.starterCount < LEAGUE_CONFIG.preDraftStarters && b.starterCount >= LEAGUE_CONFIG.preDraftStarters) return 1;
      if (b.starterCount < LEAGUE_CONFIG.preDraftStarters && a.starterCount >= LEAGUE_CONFIG.preDraftStarters) return -1;
      // Otherwise sort by score
      return a.totalScore - b.totalScore;
    });
  };

  // Fetch ESPN data
  const refreshData = useCallback(async () => {
    setLoading(true);
    const data = await fetchESPNLeaderboard();
    if (data) {
      setEspnData(data);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 120000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Commissioner login
  const handleCommissionerLogin = () => {
    if (passwordInput === COMMISSIONER_PASSWORD) {
      setIsCommissioner(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      showMessage('Welcome, Commissioner!', 'success');
    } else {
      showMessage('Incorrect password', 'error');
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Get current tournament info
  const getCurrentTournament = () => {
    if (!espnData?.events?.[0]) return null;
    const event = espnData.events[0];
    const competition = event.competitions?.[0];
    const venue = competition?.venue;

    // Try multiple venue fields for course name
    const courseName = venue?.fullName || venue?.shortName || venue?.address?.city || '';

    // Get cut line info if available
    const cutLine = competition?.cutLine?.score || null;
    const projectedCutLine = competition?.projectedCutLine?.score || competition?.status?.cutLine || null;

    return {
      name: event.name,
      status: event.status?.type?.description || 'Unknown',
      course: courseName,
      dates: `${new Date(event.date).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}`,
      cutLine,
      projectedCutLine
    };
  };

  // Get current round number based on top players' progress
  const getCurrentRound = () => {
    if (!espnData?.events?.[0]?.competitions?.[0]?.competitors) return 0;
    const competitors = espnData.events[0].competitions[0].competitors;
    const topPlayers = competitors.slice(0, 10);
    const roundsCompleted = topPlayers.map(p => {
      const linescores = p.linescores || [];
      return linescores.filter(r => r.displayValue && r.displayValue !== '-').length;
    });
    const avgRoundsCompleted = roundsCompleted.reduce((a, b) => a + b, 0) / roundsCompleted.length;

    // If avg rounds completed is 0.5, they're in round 1, if 1.5 they're in round 2, etc.
    if (avgRoundsCompleted < 0.5) return 1;
    if (avgRoundsCompleted < 1.5) return 1;
    if (avgRoundsCompleted < 2.5) return 2;
    if (avgRoundsCompleted < 3.5) return 3;
    return 4;
  };

  // Get leaderboard from ESPN data
  const getLeaderboard = () => {
    if (!espnData?.events?.[0]?.competitions?.[0]?.competitors) return [];
    return espnData.events[0].competitions[0].competitors.map((player, idx) => {
      const linescores = player.linescores || [];
      const rounds = linescores.map(r => r.displayValue || '-');
      
      // Parse individual round scores
      // ESPN displayValue can be either stroke count ("68") or relative to par ("-4")
      // We detect which by checking the value range
      const coursePar = 72;
      const roundScores = linescores.map(r => {
        const val = parseInt(r.displayValue);
        if (isNaN(val)) return null;
        // If value is in stroke count range (60-90), convert to relative to par
        // If value is in relative-to-par range (-20 to +20), use as-is
        if (val >= 50 && val <= 100) {
          return val - coursePar; // Convert stroke count to relative to par
        }
        return val; // Already relative to par
      });

      const r3RelPar = roundScores[2];
      const r4RelPar = roundScores[3];

      // Weekend score = R3 + R4 relative to par
      let weekendScore = null;
      if (r3RelPar != null || r4RelPar != null) {
        weekendScore = (r3RelPar || 0) + (r4RelPar || 0);
      }

      // Determine player status from ESPN data
      const statusType = player.status?.type?.name?.toLowerCase() || '';
      const statusDisplay = player.status?.displayValue || '';

      // Check multiple ways ESPN might indicate a cut
      const explicitCut = statusType === 'cut' ||
                          statusType.includes('cut') ||
                          statusDisplay === 'CUT' ||
                          statusDisplay.includes('CUT') ||
                          player.status?.type?.id === '3'; // ESPN cut status ID

      // Also detect cut by absence of R3 score when tournament is in R3+
      // If most players have R3 scores but this player doesn't, they likely missed cut
      // Use != null to catch both null and undefined
      const hasR3Score = roundScores[2] != null;

      const isWD = statusType === 'wd' || statusType.includes('wd') || statusDisplay === 'WD' || statusDisplay.includes('WD');
      const isDQ = statusType === 'dq' || statusType.includes('dq') || statusDisplay === 'DQ' || statusDisplay.includes('DQ');

      // A player is cut if explicitly marked OR if they have no R3 score (will be refined below)
      const isCut = explicitCut || false; // We'll set implicitCut in a second pass
      const madeCut = !explicitCut && !isWD && !isDQ && hasR3Score;

      // Determine if cut has happened (player has R3 score or is marked as cut)
      const cutHasHappened = r3RelPar != null || explicitCut;
      
      return {
        rank: player.order || idx + 1,
        id: player.id,
        name: player.athlete?.displayName || 'Unknown',
        score: player.score || 'E',
        scoreNum: parseInt(player.score) || 0,
        rounds,
        roundScores,
        weekendScore,
        thru: player.status?.thru || statusDisplay || 'F',
        country: player.athlete?.flag?.alt || '',
        statusType,
        statusDisplay,
        isCut: explicitCut, // Will be updated in second pass
        isWD,
        isDQ,
        madeCut, // Will be updated in second pass
        cutHasHappened,
        hasR3Score
      };
    });

    // Second pass: detect implicit cuts (players without R3 when most players have R3)
    const playersWithR3 = players.filter(p => p.hasR3Score && !p.isWD && !p.isDQ);
    const tournamentPastCut = playersWithR3.length > 10; // If >10 players have R3, cut has happened

    if (tournamentPastCut) {
      return players.map(p => {
        // Player implicitly missed cut if they don't have R3 and aren't WD/DQ
        const implicitCut = !p.hasR3Score && !p.isWD && !p.isDQ && !p.isCut;
        const isCut = p.isCut || implicitCut;
        const madeCut = !isCut && !p.isWD && !p.isDQ;
        return {
          ...p,
          isCut,
          madeCut
        };
      });
    }

    return players;
  };

  // Get starters for a team for current tournament (includes rentals)
  const getTeamStarters = (teamId, tournamentId = null) => {
    const tId = tournamentId || liveTournamentId;
    const tournamentLineups = lineups[tId] || {};
    const starters = tournamentLineups[teamId] || [];
    // Rentals are already added to lineups when created, so this should work
    return starters;
  };

  // Check if a player is a rental for a team in a tournament
  const isRentalPlayer = (tournamentId, teamId, playerName) => {
    const teamRentals = rentals[tournamentId]?.[teamId] || [];
    return teamRentals.some(r => r.toLowerCase() === playerName.toLowerCase());
  };

  // Check if Round 2 is complete (for winner bonus eligibility)
  const isRound3OrLater = () => {
    if (!espnData?.events?.[0]?.competitions?.[0]?.competitors) return false;
    const competitors = espnData.events[0].competitions[0].competitors;
    // Check if the majority of players have completed at least 2 rounds
    // We look at the leader or top players to determine the current round
    const topPlayers = competitors.slice(0, 10);
    const roundsCompleted = topPlayers.map(p => {
      const linescores = p.linescores || [];
      // Count completed rounds (rounds with scores)
      return linescores.filter(r => r.displayValue && r.displayValue !== '-').length;
    });
    const avgRoundsCompleted = roundsCompleted.reduce((a, b) => a + b, 0) / roundsCompleted.length;
    return avgRoundsCompleted >= 2;
  };

  // Get players currently in 1st place (could be multiple if tied)
  const getLeaders = () => {
    const leaderboard = getLeaderboard();
    if (leaderboard.length === 0) return [];
    // Find all players with rank === 1 (tied for first)
    return leaderboard.filter(p => p.rank === 1).map(p => p.name.toLowerCase());
  };

  // Check if cut has happened in the tournament
  const hasCutHappened = () => {
    const leaderboard = getLeaderboard();
    return leaderboard.some(p => p.isCut || p.cutHasHappened);
  };

  // Get current projected MC penalty (worst weekend score among cut makers)
  const getProjectedMCPenalty = () => {
    const leaderboard = getLeaderboard();
    const cutMakersWithWeekendScores = leaderboard.filter(p => p.madeCut && p.weekendScore !== null);
    if (cutMakersWithWeekendScores.length === 0) return null;
    return Math.max(...cutMakersWithWeekendScores.map(p => p.weekendScore));
  };

  // Check if tournament is still in progress (not finished)
  const isTournamentInProgress = () => {
    const currentRound = getCurrentRound();
    return currentRound >= 1 && currentRound <= 4 && tournament?.status !== 'Final';
  };

  // Calculate team scores based on rostered players and current leaderboard
  const calculateTeamStandings = () => {
    const leaderboard = getLeaderboard();
    const currentTournament = [...LEAGUE_CONFIG.season1Tournaments, ...LEAGUE_CONFIG.season2Tournaments]
      .find(t => t.id === liveTournamentId);
    const isMajor = currentTournament?.isMajor || false;
    const requiredStarters = isMajor ? LEAGUE_CONFIG.startersMajor : LEAGUE_CONFIG.startersRegular;
    
    // Check if winner bonus is active (Round 3 or later AND toggle is enabled)
    const winnerBonusActive = isRound3OrLater() && bonusEnabled;
    const leaders = winnerBonusActive ? getLeaders() : [];
    
    // Calculate penalty scores for MC/WD/DQ
    // Get all starters across all teams for WD/DQ penalty calculation
    const allLeagueStarters = LEAGUE_CONFIG.teams.flatMap(team => {
      const starters = getTeamStarters(team.id, liveTournamentId);
      return starters.map(name => {
        const player = leaderboard.find(p => p.name.toLowerCase() === name.toLowerCase());
        return player;
      }).filter(Boolean);
    });
    
    // For MC penalty: worst weekend score of any player who made the cut
    const cutMakersWithWeekendScores = leaderboard.filter(p => p.madeCut && p.weekendScore !== null);
    const worstWeekendScore = cutMakersWithWeekendScores.length > 0
      ? Math.max(...cutMakersWithWeekendScores.map(p => p.weekendScore))
      : 0;
    
    // For WD/DQ before cut: worst score of any non-WD/DQ league starter
    const nonWDDQStarters = allLeagueStarters.filter(p => !p.isWD && !p.isDQ);
    const worstStarterScore = nonWDDQStarters.length > 0
      ? Math.max(...nonWDDQStarters.map(p => p.scoreNum))
      : 0;
    
    // For WD/DQ after cut: worst score of any non-WD/DQ league starter who made cut
    const nonWDDQStartersWhoCut = nonWDDQStarters.filter(p => p.madeCut);
    const worstStarterScoreAfterCut = nonWDDQStartersWhoCut.length > 0
      ? Math.max(...nonWDDQStartersWhoCut.map(p => p.scoreNum))
      : 0;
    
    // Check if cut has happened
    const cutHasHappened = leaderboard.some(p => p.isCut || p.cutHasHappened);

    const standings = LEAGUE_CONFIG.teams.map(team => {
      const roster = rosters[team.id];
      const starters = getTeamStarters(team.id, liveTournamentId);
      const teamRentals = getTeamRentals(liveTournamentId, team.id);
      let totalScore = 0;
      let starterScores = [];
      let hasLeader = false;
      let penalties = [];

      starters.forEach(playerName => {
        const player = leaderboard.find(p => 
          p.name.toLowerCase() === playerName.toLowerCase()
        );
        if (player) {
          let playerScore = player.scoreNum;
          let penaltyApplied = null;
          
          // Apply MC penalty: worst weekend score
          if (player.isCut && cutHasHappened) {
            // Player's score is their R1+R2, add worst weekend score as penalty
            const mcPenalty = worstWeekendScore;
            playerScore = player.scoreNum + mcPenalty;
            penaltyApplied = { type: 'MC', penalty: mcPenalty };
          }
          // Apply WD/DQ penalty
          else if (player.isWD || player.isDQ) {
            if (player.madeCut || (cutHasHappened && player.roundScores[2] !== null)) {
              // WD/DQ after cut: worst score of non-WD/DQ starter who made cut
              playerScore = worstStarterScoreAfterCut;
              penaltyApplied = { type: player.isWD ? 'WD' : 'DQ', penalty: worstStarterScoreAfterCut, afterCut: true };
            } else {
              // WD/DQ before cut: worst score of any non-WD/DQ starter
              playerScore = worstStarterScore;
              penaltyApplied = { type: player.isWD ? 'WD' : 'DQ', penalty: worstStarterScore, afterCut: false };
            }
          }
          
          totalScore += playerScore;
          
          const displayScore = playerScore === 0 ? 'E' : (playerScore < 0 ? playerScore : `+${playerScore}`);
          const isRental = teamRentals.some(r => r.toLowerCase() === playerName.toLowerCase());
          starterScores.push({ 
            name: playerName, 
            score: penaltyApplied ? displayScore : player.score,
            originalScore: player.score,
            rank: player.rank,
            isCut: player.isCut,
            isWD: player.isWD,
            isDQ: player.isDQ,
            penaltyApplied,
            isRental
          });
          
          // Check if this starter is a leader (only if not MC/WD/DQ)
          if (!player.isCut && !player.isWD && !player.isDQ && leaders.includes(playerName.toLowerCase())) {
            hasLeader = true;
          }
          
          if (penaltyApplied) {
            penalties.push({ player: playerName, ...penaltyApplied });
          }
        }
      });

      // Apply -10 winner bonus if team has a starter in 1st place
      const winnerBonus = hasLeader ? -10 : 0;
      const adjustedScore = totalScore + winnerBonus;

      return {
        ...team,
        totalScore: adjustedScore,
        rawScore: totalScore,
        winnerBonus,
        hasLeader,
        displayScore: starterScores.length > 0 
          ? (adjustedScore === 0 ? 'E' : (adjustedScore < 0 ? adjustedScore : `+${adjustedScore}`))
          : '-',
        rawDisplayScore: totalScore === 0 ? 'E' : (totalScore < 0 ? totalScore : `+${totalScore}`),
        players: roster?.players || [],
        starters: starterScores,
        starterNames: starters,
        requiredStarters,
        penalties,
        points: 0
      };
    });

    return standings.sort((a, b) => a.totalScore - b.totalScore);
  };

  // Add player to roster
  const addPlayerToRoster = (teamId, playerName, round) => {
    const newRosters = { ...rosters };
    if (!newRosters[teamId]) {
      newRosters[teamId] = { players: [] };
    }
    
    // Check if player already on this roster
    if (newRosters[teamId].players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      showMessage('Player already on this roster', 'error');
      return;
    }
    
    // Check if player on another roster
    for (const [tid, roster] of Object.entries(newRosters)) {
      if (roster.players?.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
        const otherTeam = LEAGUE_CONFIG.teams.find(t => t.id === parseInt(tid));
        showMessage(`Player already on ${otherTeam?.name}'s roster`, 'error');
        return;
      }
    }
    
    newRosters[teamId].players.push({ name: playerName, round });
    saveRosters(newRosters);
    showMessage(`${playerName} added to roster`, 'success');
  };

  // Remove player from roster
  const removePlayerFromRoster = (teamId, playerName) => {
    const newRosters = { ...rosters };
    newRosters[teamId].players = newRosters[teamId].players.filter(
      p => p.name.toLowerCase() !== playerName.toLowerCase()
    );
    saveRosters(newRosters);
    
    // Also remove from any lineups
    const newLineups = { ...lineups };
    Object.keys(newLineups).forEach(tournamentId => {
      if (newLineups[tournamentId][teamId]) {
        newLineups[tournamentId][teamId] = newLineups[tournamentId][teamId].filter(
          p => p.toLowerCase() !== playerName.toLowerCase()
        );
      }
    });
    saveLineups(newLineups);
    showMessage(`${playerName} removed from roster`, 'success');
  };

  // Toggle starter
  const toggleStarter = (teamId, playerName) => {
    const currentTournament = [...LEAGUE_CONFIG.season1Tournaments, ...LEAGUE_CONFIG.season2Tournaments]
      .find(t => t.id === selectedTournament);
    const isMajor = currentTournament?.isMajor || false;
    const maxStarters = isMajor ? LEAGUE_CONFIG.startersMajor : LEAGUE_CONFIG.startersRegular;

    const newLineups = { ...lineups };
    if (!newLineups[selectedTournament]) {
      newLineups[selectedTournament] = {};
    }
    if (!newLineups[selectedTournament][teamId]) {
      newLineups[selectedTournament][teamId] = [];
    }

    const currentStarters = newLineups[selectedTournament][teamId];
    const isCurrentlyStarter = currentStarters.some(
      p => p.toLowerCase() === playerName.toLowerCase()
    );

    if (isCurrentlyStarter) {
      // Remove from starters
      newLineups[selectedTournament][teamId] = currentStarters.filter(
        p => p.toLowerCase() !== playerName.toLowerCase()
      );
    } else {
      // Add to starters if not at max
      if (currentStarters.length >= maxStarters) {
        showMessage(`Maximum ${maxStarters} starters for this tournament`, 'error');
        return;
      }
      newLineups[selectedTournament][teamId] = [...currentStarters, playerName];
    }

    saveLineups(newLineups);
  };

  const tournament = getCurrentTournament();
  const leaderboard = getLeaderboard();
  const teamStandings = calculateTeamStandings();

  const currentTournamentConfig = [...LEAGUE_CONFIG.season1Tournaments, ...LEAGUE_CONFIG.season2Tournaments]
    .find(t => t.id === selectedTournament);

  return (
    <>
      <style>{styles}</style>
      <div className="app-container">
        {/* Password Modal */}
        {showPasswordModal && (
          <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>🔐 Commissioner Login</h2>
              <p>Enter the commissioner password to access admin features.</p>
              <div className="form-group">
                <input
                  type="password"
                  className="form-input"
                  placeholder="Password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleCommissionerLogin()}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-orange" onClick={handleCommissionerLogin}>
                  Login
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="header">
          <div className="logo">
            <div className="logo-icon">⛳</div>
            <div className="logo-text">
              <span>Highline</span> Fantasy Golf
            </div>
          </div>
          
          <nav className="nav-tabs">
            <button 
              className={`nav-tab ${activeTab === 'live' ? 'active' : ''}`}
              onClick={() => setActiveTab('live')}
            >
              Live Scoring
            </button>
            <button 
              className={`nav-tab ${activeTab === 'rosters' ? 'active' : ''}`}
              onClick={() => setActiveTab('rosters')}
            >
              Rosters
            </button>
            <button 
              className={`nav-tab ${activeTab === 'standings' ? 'active' : ''}`}
              onClick={() => setActiveTab('standings')}
            >
              Standings
            </button>
            {isCommissioner && (
              <button 
                className={`nav-tab commissioner ${activeTab === 'commissioner' ? 'active' : ''}`}
                onClick={() => setActiveTab('commissioner')}
              >
                ⚙️ Commissioner
              </button>
            )}
          </nav>

          <div className="header-right">
            {espnData && (
              <div className="live-indicator">
                <div className="live-dot"></div>
                Live Data
              </div>
            )}
            {isCommissioner ? (
              <div className="commissioner-badge" onClick={() => setIsCommissioner(false)}>
                👑 Commissioner Mode
              </div>
            ) : (
              <button className="commissioner-badge" onClick={() => setShowPasswordModal(true)}>
                🔐 Commissioner Login
              </button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="main-content">
          {message && (
            <div className={`message ${message.type}`}>
              {message.text}
            </div>
          )}

          {activeTab === 'live' && (
            <>
              {/* Tournament Selector */}
              <div className="tournament-header">
                <div className="tournament-info">
                  <div className="tournament-selector">
                    <select 
                      className="tournament-dropdown"
                      value={liveTournamentId}
                      onChange={e => setLiveTournamentId(e.target.value)}
                    >
                      <optgroup label="Pre-Draft">
                        {getAllTournaments().filter(t => t.season === 0).map(t => (
                          <option key={t.id} value={t.id}>
                            {t.status === 'live' ? '🔴 ' : t.status === 'final' ? '✅ ' : '⏳ '}
                            🎯 {t.name} - {t.dates}
                            {t.status === 'upcoming' ? ' (Upcoming)' : t.status === 'final' ? ' (Final)' : ' (LIVE)'}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Season 1">
                        {getAllTournaments().filter(t => t.season === 1).map(t => (
                          <option key={t.id} value={t.id}>
                            {t.status === 'live' ? '🔴 ' : t.status === 'final' ? '✅ ' : '⏳ '}
                            {t.name} {t.isMajor ? '⭐' : ''} - {t.dates}
                            {t.status === 'upcoming' ? ' (Upcoming)' : t.status === 'final' ? ' (Final)' : ' (LIVE)'}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Season 2">
                        {getAllTournaments().filter(t => t.season === 2).map(t => (
                          <option key={t.id} value={t.id}>
                            {t.status === 'live' ? '🔴 ' : t.status === 'final' ? '✅ ' : '⏳ '}
                            {t.name} {t.isMajor ? '⭐' : ''} - {t.dates}
                            {t.status === 'upcoming' ? ' (Upcoming)' : t.status === 'final' ? ' (Final)' : ' (LIVE)'}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  {(() => {
                    const selectedTourneyConfig = getAllTournaments().find(t => t.id === liveTournamentId);
                    const tourneyStatus = selectedTourneyConfig?.status;
                    return (
                      <div className="tournament-meta">
                        {selectedTourneyConfig?.isPreDraft && (
                          <span className="predraft-badge">🎯 Determines Season 1 Draft Order</span>
                        )}
                        {tourneyStatus === 'live' && tournament && (
                          <>
                            {tournament.course && <span>📍 {tournament.course}</span>}
                            <span>🏆 {tournament.status}</span>
                            <span className="round-badge">Round {getCurrentRound()}</span>
                            {getCurrentRound() === 2 && tournament.projectedCutLine && (
                              <span className="cut-line-badge">✂️ Proj. Cut: {tournament.projectedCutLine > 0 ? '+' : ''}{tournament.projectedCutLine}</span>
                            )}
                          </>
                        )}
                        {tourneyStatus === 'upcoming' && !selectedTourneyConfig?.isPreDraft && (
                          <span className="status-upcoming">⏳ Tournament has not started yet</span>
                        )}
                        {tourneyStatus === 'upcoming' && selectedTourneyConfig?.isPreDraft && (
                          <span className="status-upcoming">⏳ Pre-draft tournament upcoming</span>
                        )}
                        {tourneyStatus === 'final' && (
                          <span className="status-final">✅ Tournament Complete</span>
                        )}
                        {selectedTourneyConfig?.isMajor && (
                          <span className="major-badge">⭐ MAJOR - 2x Points</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {getAllTournaments().find(t => t.id === liveTournamentId)?.status === 'live' && (
                    <button className="refresh-btn" onClick={refreshData}>
                      🔄 Refresh
                      {lastUpdated && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {lastUpdated.toLocaleTimeString()}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Show content based on tournament status */}
              {(() => {
                const selectedTourneyConfig = getAllTournaments().find(t => t.id === liveTournamentId);
                const tourneyStatus = selectedTourneyConfig?.status;
                const isPreDraft = selectedTourneyConfig?.isPreDraft;

                // Pre-draft tournament display
                if (isPreDraft) {
                  if (tourneyStatus === 'upcoming') {
                    return (
                      <>
                        <div className="upcoming-tournament">
                          <div className="upcoming-icon">🎯</div>
                          <h2>Pre-Draft Tournament Upcoming</h2>
                          <p>{selectedTourneyConfig?.name} begins {selectedTourneyConfig?.dates}</p>
                          <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>
                            This tournament determines Season 1 draft order.
                          </p>
                        </div>

                        {/* Commissioner Pre-Draft Lineup Editor - shown even for upcoming */}
                        {isCommissioner && (
                          <div className="card commissioner-card" style={{ marginTop: '24px' }}>
                            <div className="card-header commissioner-header">
                              <div className="card-title">⚙️ Enter Pre-Draft Lineups</div>
                            </div>
                            <div className="commissioner-panel">
                              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                                Enter each team's 4 player picks for the pre-draft tournament.
                              </p>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label">Select Team</label>
                                  <select 
                                    className="form-select"
                                    value={selectedTeamForPreDraft}
                                    onChange={e => setSelectedTeamForPreDraft(parseInt(e.target.value))}
                                  >
                                    {LEAGUE_CONFIG.teams.map(team => {
                                      const count = getPreDraftStarters(team.id).length;
                                      return (
                                        <option key={team.id} value={team.id}>
                                          {team.name} ({count}/{LEAGUE_CONFIG.preDraftStarters})
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label">Search Player</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Type player name..."
                                    value={preDraftSearchQuery}
                                    onChange={e => setPreDraftSearchQuery(e.target.value)}
                                  />
                                </div>
                              </div>

                              {/* Current lineup for selected team */}
                              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                  {LEAGUE_CONFIG.teams.find(t => t.id === selectedTeamForPreDraft)?.name}'s Pre-Draft Picks:
                                </h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {getPreDraftStarters(selectedTeamForPreDraft).length > 0 ? (
                                    getPreDraftStarters(selectedTeamForPreDraft).map((name, idx) => (
                                      <span key={idx} style={{
                                        padding: '6px 12px',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                      }}>
                                        {name}
                                        <button
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--accent-red)',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            padding: 0
                                          }}
                                          onClick={() => removePreDraftPlayer(selectedTeamForPreDraft, name)}
                                        >
                                          ✕
                                        </button>
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No picks yet</span>
                                  )}
                                </div>
                              </div>

                              {/* Player search results */}
                              {preDraftSearchQuery && (
                                <div className="player-search-results" style={{ maxHeight: '250px' }}>
                                  {PGA_PLAYERS
                                    .filter(p => p.name.toLowerCase().includes(preDraftSearchQuery.toLowerCase()))
                                    .slice(0, 15)
                                    .map(player => {
                                      const isPickedByThisTeam = getPreDraftStarters(selectedTeamForPreDraft)
                                        .some(p => p.toLowerCase() === player.name.toLowerCase());
                                      
                                      let pickedByOther = null;
                                      for (const team of LEAGUE_CONFIG.teams) {
                                        if (team.id !== selectedTeamForPreDraft) {
                                          if (getPreDraftStarters(team.id).some(p => p.toLowerCase() === player.name.toLowerCase())) {
                                            pickedByOther = team.name;
                                            break;
                                          }
                                        }
                                      }
                                      
                                      return (
                                        <div key={player.name} className="player-search-item">
                                          <div>
                                            <div style={{ fontWeight: 500 }}>{player.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                              OWGR #{player.rank}
                                              {pickedByOther && (
                                                <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                                                  • Also picked by {pickedByOther}
                                                </span>
                                              )}
                                              {isPickedByThisTeam && (
                                                <span style={{ color: 'var(--accent-blue)', marginLeft: '8px' }}>
                                                  • Already picked
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          {!isPickedByThisTeam && getPreDraftStarters(selectedTeamForPreDraft).length < LEAGUE_CONFIG.preDraftStarters && (
                                            <button
                                              className="btn btn-sm"
                                              onClick={() => {
                                                addPreDraftPlayer(selectedTeamForPreDraft, player.name);
                                                setPreDraftSearchQuery('');
                                              }}
                                            >
                                              Add Pick
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              )}

                              {/* Summary of all teams */}
                              <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>All Teams Status:</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                  {LEAGUE_CONFIG.teams.map(team => {
                                    const picks = getPreDraftStarters(team.id);
                                    const isComplete = picks.length === LEAGUE_CONFIG.preDraftStarters;
                                    return (
                                      <div key={team.id} style={{ 
                                        padding: '8px 12px', 
                                        background: 'var(--bg-card)', 
                                        borderRadius: '6px',
                                        border: `1px solid ${isComplete ? 'var(--accent-green)' : 'var(--border-color)'}`,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                      }}>
                                        <span style={{ fontWeight: 500 }}>{team.name}</span>
                                        <span style={{ 
                                          fontSize: '12px', 
                                          color: isComplete ? 'var(--accent-green)' : 'var(--text-muted)'
                                        }}>
                                          {picks.length}/{LEAGUE_CONFIG.preDraftStarters} {isComplete && '✓'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  }

                  // Live or Final pre-draft - show pre-draft standings
                  const preDraftStandings = calculatePreDraftStandings();
                  return loading ? (
                    <div className="loading">
                      <div className="loading-spinner"></div>
                      <p>Fetching live scores...</p>
                    </div>
                  ) : (
                    <>
                      {/* Pre-Draft Standings - Horizontal Scoreboard */}
                      <div className="team-scoreboard">
                        <div className="scoreboard-header">
                          <div className="scoreboard-title">
                            🎯 Draft Order Standings
                            {isRound3OrLater() && (
                              <button
                                className={`bonus-toggle ${bonusEnabled ? 'active' : 'inactive'}`}
                                onClick={() => setBonusEnabled(!bonusEnabled)}
                                title={bonusEnabled ? 'Click to exclude winner bonus from scores' : 'Click to include winner bonus in scores'}
                              >
                                {bonusEnabled ? '✓' : '✗'} -10 Winner Bonus
                              </button>
                            )}
                            {hasCutHappened() && isTournamentInProgress() && getProjectedMCPenalty() !== null && (
                              <span className="mc-penalty-badge">
                                Projected MC penalty: +{getProjectedMCPenalty()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="scoreboard-grid">
                          {preDraftStandings.map((team, idx) => {
                            const scoreNum = team.totalScore;
                            const isLeading = idx === 0 && team.starterCount === LEAGUE_CONFIG.preDraftStarters;
                            const hasFullLineup = team.starterCount === LEAGUE_CONFIG.preDraftStarters;
                            return (
                              <div key={team.id} className={`scoreboard-team ${isLeading ? 'leading' : ''}`}>
                                <div className="scoreboard-team-header">
                                  <div className="scoreboard-rank" style={!hasFullLineup ? { background: 'var(--accent-orange)', color: 'var(--bg-primary)' } : {}}>
                                    {hasFullLineup ? idx + 1 : '?'}
                                  </div>
                                  <div className="scoreboard-team-name">
                                    {team.name}
                                    {team.hasLeader && <span className="leader-badge">👑</span>}
                                  </div>
                                  <div className={`scoreboard-team-total ${scoreNum < 0 ? 'under-par' : scoreNum > 0 ? 'over-par' : ''}`}>
                                    {hasFullLineup ? team.displayScore : '-'}
                                  </div>
                                </div>
                                <div className="scoreboard-players">
                                  {team.starters.length > 0 ? (
                                    team.starters.map((starter, sIdx) => {
                                      const bonusActive = isRound3OrLater();
                                      const isLeader = bonusActive && !starter.isCut && !starter.isWD && !starter.isDQ && getLeaders().includes(starter.name.toLowerCase());
                                      const hasPenalty = starter.isCut || starter.isWD || starter.isDQ;
                                      const playerScore = starter.scoreNum || 0;
                                      return (
                                        <div key={sIdx} className={`scoreboard-player ${starter.notInField ? 'penalty' : ''} ${hasPenalty ? 'penalty' : ''} ${isLeader ? 'leader' : ''}`}>
                                          <span className="scoreboard-player-name">
                                            {starter.name.split(' ').pop()}
                                            {starter.notInField && <span className="status-badge">N/A</span>}
                                            {hasPenalty && <span className="status-badge">{starter.isCut ? 'MC' : starter.isWD ? 'WD' : 'DQ'}</span>}
                                            {isLeader && <span className="bonus-indicator">⭐</span>}
                                          </span>
                                          <span className={`scoreboard-player-score ${playerScore < 0 ? 'under-par' : playerScore > 0 ? 'over-par' : ''}`}>
                                            {starter.score}
                                          </span>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="no-starters">No picks submitted</div>
                                  )}
                                  {team.starterCount < LEAGUE_CONFIG.preDraftStarters && team.starterCount > 0 && (
                                    <div style={{ fontSize: '10px', color: 'var(--accent-orange)', textAlign: 'center', marginTop: '4px' }}>
                                      {LEAGUE_CONFIG.preDraftStarters - team.starterCount} more pick{LEAGUE_CONFIG.preDraftStarters - team.starterCount > 1 ? 's' : ''} needed
                                    </div>
                                  )}
                                </div>
                                {team.hasLeader && (
                                  <div className="scoreboard-bonus">
                                    Winner Bonus: -10
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Draft Order Table */}
                      <div className="card" style={{ marginTop: '24px' }}>
                        <div className="card-header">
                          <div className="card-title">
                            📋 Season 1 Draft Order
                            <span className="card-badge">{preDraftStandings.filter(t => t.starterCount === LEAGUE_CONFIG.preDraftStarters).length}/10 lineups submitted</span>
                          </div>
                        </div>
                        <div style={{ padding: '20px' }}>
                          <table className="leaderboard-table">
                            <thead>
                              <tr>
                                <th>Pick</th>
                                <th>Team</th>
                                <th>Score</th>
                                <th>Starters</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preDraftStandings.map((team, idx) => {
                                const hasFullLineup = team.starterCount === LEAGUE_CONFIG.preDraftStarters;
                                return (
                                  <tr key={team.id} style={!hasFullLineup ? { opacity: 0.5 } : {}}>
                                    <td className={`rank ${idx < 3 && hasFullLineup ? 'top-3' : ''}`}>
                                      {hasFullLineup ? idx + 1 : '-'}
                                    </td>
                                    <td>
                                      <div className="player-name">{team.name}</div>
                                    </td>
                                    <td className={`score ${team.totalScore < 0 ? 'under-par' : team.totalScore > 0 ? 'over-par' : ''}`}>
                                      {hasFullLineup ? team.displayScore : 'Incomplete'}
                                    </td>
                                    <td>
                                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {team.starters.map(s => s.name.split(' ').pop()).join(', ') || 'None'}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Commissioner Pre-Draft Lineup Editor */}
                      {isCommissioner && (
                        <div className="card commissioner-card" style={{ marginTop: '24px' }}>
                          <div className="card-header commissioner-header">
                            <div className="card-title">⚙️ Enter Pre-Draft Lineups</div>
                          </div>
                          <div className="commissioner-panel">
                            <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                              Enter each team's 4 player picks for the pre-draft tournament.
                            </p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', marginBottom: '16px' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Select Team</label>
                                <select 
                                  className="form-select"
                                  value={selectedTeamForPreDraft}
                                  onChange={e => setSelectedTeamForPreDraft(parseInt(e.target.value))}
                                >
                                  {LEAGUE_CONFIG.teams.map(team => {
                                    const count = getPreDraftStarters(team.id).length;
                                    return (
                                      <option key={team.id} value={team.id}>
                                        {team.name} ({count}/{LEAGUE_CONFIG.preDraftStarters})
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Search Player</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Type player name..."
                                  value={preDraftSearchQuery}
                                  onChange={e => setPreDraftSearchQuery(e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Current lineup for selected team */}
                            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                              <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                {LEAGUE_CONFIG.teams.find(t => t.id === selectedTeamForPreDraft)?.name}'s Pre-Draft Picks:
                              </h4>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {getPreDraftStarters(selectedTeamForPreDraft).length > 0 ? (
                                  getPreDraftStarters(selectedTeamForPreDraft).map((name, idx) => (
                                    <span key={idx} style={{
                                      padding: '6px 12px',
                                      background: 'var(--bg-card)',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '6px',
                                      fontSize: '13px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}>
                                      {name}
                                      <button
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: 'var(--accent-red)',
                                          cursor: 'pointer',
                                          fontSize: '14px',
                                          padding: 0
                                        }}
                                        onClick={() => removePreDraftPlayer(selectedTeamForPreDraft, name)}
                                      >
                                        ✕
                                      </button>
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No picks yet</span>
                                )}
                              </div>
                            </div>

                            {/* Player search results */}
                            {preDraftSearchQuery && (
                              <div className="player-search-results" style={{ maxHeight: '250px' }}>
                                {PGA_PLAYERS
                                  .filter(p => p.name.toLowerCase().includes(preDraftSearchQuery.toLowerCase()))
                                  .slice(0, 15)
                                  .map(player => {
                                    const isPickedByThisTeam = getPreDraftStarters(selectedTeamForPreDraft)
                                      .some(p => p.toLowerCase() === player.name.toLowerCase());
                                    
                                    let pickedByOther = null;
                                    for (const team of LEAGUE_CONFIG.teams) {
                                      if (team.id !== selectedTeamForPreDraft) {
                                        if (getPreDraftStarters(team.id).some(p => p.toLowerCase() === player.name.toLowerCase())) {
                                          pickedByOther = team.name;
                                          break;
                                        }
                                      }
                                    }

                                    const leaderboardPlayer = getLeaderboard().find(
                                      p => p.name.toLowerCase() === player.name.toLowerCase()
                                    );
                                    
                                    return (
                                      <div key={player.name} className="player-search-item">
                                        <div>
                                          <div style={{ fontWeight: 500 }}>{player.name}</div>
                                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            OWGR #{player.rank}
                                            {leaderboardPlayer && (
                                              <span style={{ color: 'var(--accent-green)', marginLeft: '8px' }}>
                                                • In field: {leaderboardPlayer.score}
                                              </span>
                                            )}
                                            {!leaderboardPlayer && (
                                              <span style={{ color: 'var(--accent-orange)', marginLeft: '8px' }}>
                                                • Not in field
                                              </span>
                                            )}
                                            {pickedByOther && (
                                              <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                                                • Also picked by {pickedByOther}
                                              </span>
                                            )}
                                            {isPickedByThisTeam && (
                                              <span style={{ color: 'var(--accent-blue)', marginLeft: '8px' }}>
                                                • Already picked
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        {!isPickedByThisTeam && getPreDraftStarters(selectedTeamForPreDraft).length < LEAGUE_CONFIG.preDraftStarters && (
                                          <button
                                            className="btn btn-sm"
                                            onClick={() => {
                                              addPreDraftPlayer(selectedTeamForPreDraft, player.name);
                                              setPreDraftSearchQuery('');
                                            }}
                                          >
                                            Add Pick
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                }

                if (tourneyStatus === 'upcoming') {
                  return (
                    <div className="upcoming-tournament">
                      <div className="upcoming-icon">⏳</div>
                      <h2>Tournament Upcoming</h2>
                      <p>{selectedTourneyConfig?.name} begins {selectedTourneyConfig?.dates}</p>
                      <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>
                        Set your lineups in the Commissioner panel before the tournament starts.
                      </p>
                    </div>
                  );
                }

                if (tourneyStatus === 'final') {
                  const results = tournamentResults[liveTournamentId];
                  if (results) {
                    return (
                      <div className="final-results">
                        <h2>🏆 Final Results: {selectedTourneyConfig?.name}</h2>
                        {/* Show saved results */}
                        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                          Results have been finalized for this tournament.
                        </p>
                      </div>
                    );
                  }
                }

                // Live tournament - show normal scoreboard
                return loading ? (
                  <div className="loading">
                    <div className="loading-spinner"></div>
                    <p>Fetching live scores...</p>
                  </div>
                ) : (
                  <>
                  {/* Horizontal Team Scoreboard */}
                  <div className="team-scoreboard">
                    <div className="scoreboard-header">
                      <div className="scoreboard-title">
                        🏆 Team Standings
                        {isRound3OrLater() && (
                          <button
                            className={`bonus-toggle ${bonusEnabled ? 'active' : 'inactive'}`}
                            onClick={() => setBonusEnabled(!bonusEnabled)}
                            title={bonusEnabled ? 'Click to exclude winner bonus from scores' : 'Click to include winner bonus in scores'}
                          >
                            {bonusEnabled ? '✓' : '✗'} -10 Winner Bonus
                          </button>
                        )}
                        {hasCutHappened() && isTournamentInProgress() && getProjectedMCPenalty() !== null && (
                          <span className="mc-penalty-badge">
                            Projected MC penalty: +{getProjectedMCPenalty()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="scoreboard-grid">
                      {teamStandings.map((team, idx) => {
                        const scoreNum = team.totalScore;
                        const isLeading = idx === 0 && team.starters.length > 0;
                        return (
                          <div key={team.id} className={`scoreboard-team ${isLeading ? 'leading' : ''}`}>
                            <div className="scoreboard-team-header">
                              <div className="scoreboard-rank">{idx + 1}</div>
                              <div className="scoreboard-team-name">
                                {team.name}
                                {team.hasLeader && <span className="leader-badge">👑</span>}
                              </div>
                              <div className={`scoreboard-team-total ${scoreNum < 0 ? 'under-par' : scoreNum > 0 ? 'over-par' : ''}`}>
                                {team.starters.length > 0 ? team.displayScore : '-'}
                              </div>
                            </div>
                            <div className="scoreboard-players">
                              {team.starters.length > 0 ? (
                                team.starters.map((starter, sIdx) => {
                                  const bonusActive = isRound3OrLater();
                                  const isLeader = bonusActive && !starter.isCut && !starter.isWD && !starter.isDQ && getLeaders().includes(starter.name.toLowerCase());
                                  const hasPenalty = starter.isCut || starter.isWD || starter.isDQ;
                                  const playerScore = parseInt(starter.score) || 0;
                                  return (
                                    <div key={sIdx} className={`scoreboard-player ${hasPenalty ? 'penalty' : ''} ${isLeader ? 'leader' : ''} ${starter.isRental ? 'rental' : ''}`}>
                                      <span className="scoreboard-player-name">
                                        {starter.name.split(' ').pop()}
                                        {starter.isRental && <span className="rental-badge">R</span>}
                                        {hasPenalty && <span className="status-badge">{starter.isCut ? 'MC' : starter.isWD ? 'WD' : 'DQ'}</span>}
                                        {isLeader && <span className="bonus-indicator">⭐</span>}
                                      </span>
                                      <span className={`scoreboard-player-score ${playerScore < 0 ? 'under-par' : playerScore > 0 ? 'over-par' : ''}`}>
                                        {starter.score}
                                      </span>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="no-starters">No starters set</div>
                              )}
                            </div>
                            {team.hasLeader && (
                              <div className="scoreboard-bonus">
                                Winner Bonus: -10
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tournament Leaderboard */}
                  <div className="card" style={{ marginTop: '24px' }}>
                    <div className="card-header">
                      <div className="card-title">
                        🏌️ Tournament Leaderboard
                        <span className="card-badge">{leaderboard.length} players</span>
                      </div>
                    </div>
                    <table className="leaderboard-table">
                      <thead>
                        <tr>
                          <th>Pos</th>
                          <th>Player</th>
                          <th>Score</th>
                          <th>Rounds</th>
                          <th>Thru</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.slice(0, 30).map((player, idx) => {
                          const scoreNum = player.scoreNum || 0;
                          const scoreClass = scoreNum < 0 ? 'under-par' : scoreNum > 0 ? 'over-par' : 'even-par';
                          const teamOwner = teamStandings.find(t => 
                            t.starterNames.some(s => s.toLowerCase() === player.name.toLowerCase())
                          );
                          const isLeader = player.rank === 1;
                          const bonusActive = isRound3OrLater() && isLeader && !player.isCut && !player.isWD && !player.isDQ;
                          
                          // Determine row background based on status
                          let rowStyle = {};
                          if (isLeader && !player.isCut && !player.isWD && !player.isDQ) {
                            rowStyle = { background: 'rgba(255, 215, 0, 0.1)' };
                          } else if (player.isCut) {
                            rowStyle = { background: 'rgba(255, 71, 87, 0.05)' };
                          } else if (player.isWD || player.isDQ) {
                            rowStyle = { background: 'rgba(255, 159, 67, 0.05)' };
                          }
                          
                          return (
                            <tr key={player.id || idx} style={rowStyle}>
                              <td className={`rank ${player.rank <= 3 && !player.isCut && !player.isWD && !player.isDQ ? 'top-3' : ''}`}>
                                {player.isCut ? 'MC' : player.isWD ? 'WD' : player.isDQ ? 'DQ' : player.rank === 1 ? '👑' : player.rank}
                              </td>
                              <td>
                                <div className="player-name" style={player.isCut || player.isWD || player.isDQ ? { color: 'var(--text-muted)' } : {}}>
                                  {player.name}
                                  {bonusActive && teamOwner && (
                                    <span style={{ 
                                      marginLeft: '8px', 
                                      fontSize: '11px',
                                      color: 'var(--accent-gold)',
                                      fontWeight: '600'
                                    }}>
                                      -10 BONUS
                                    </span>
                                  )}
                                  {player.isCut && teamOwner && (
                                    <span style={{ 
                                      marginLeft: '8px', 
                                      fontSize: '11px',
                                      color: 'var(--accent-red)',
                                      fontWeight: '500'
                                    }}>
                                      +MC PENALTY
                                    </span>
                                  )}
                                  {(player.isWD || player.isDQ) && teamOwner && (
                                    <span style={{ 
                                      marginLeft: '8px', 
                                      fontSize: '11px',
                                      color: 'var(--accent-orange)',
                                      fontWeight: '500'
                                    }}>
                                      +{player.isWD ? 'WD' : 'DQ'} PENALTY
                                    </span>
                                  )}
                                </div>
                                {teamOwner && (
                                  <div className="player-team">🏆 {teamOwner.name}</div>
                                )}
                              </td>
                              <td className={`score ${player.isCut || player.isWD || player.isDQ ? '' : scoreClass}`} 
                                  style={player.isCut || player.isWD || player.isDQ ? { color: 'var(--text-muted)' } : {}}>
                                {player.score}
                              </td>
                              <td>
                                <div className="round-scores">
                                  {player.rounds.map((r, i) => (
                                    <span key={i} className="round-score">{r}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="thru">{player.thru}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                );
              })()}
            </>
          )}

          {activeTab === 'rosters' && (
            <>
              <div className="tournament-header">
                <div className="tournament-info">
                  <h1>Team Rosters</h1>
                  <div className="tournament-meta">
                    <span>7 players per team • Drafted players shown with round</span>
                  </div>
                </div>
              </div>

              <div className="roster-grid">
                {LEAGUE_CONFIG.teams.map(team => {
                  const roster = rosters[team.id];
                  const starters = getTeamStarters(team.id);
                  const teamStanding = teamStandings.find(t => t.id === team.id);
                  
                  return (
                    <div key={team.id} className="roster-card">
                      <div className="roster-header">
                        <div className="roster-team-name">{team.name}</div>
                        <div className="roster-status">
                          {roster?.players?.length || 0}/7 players
                        </div>
                      </div>
                      <div className="roster-players">
                        {(roster?.players || []).map((player, idx) => {
                          const isStarter = starters.some(
                            s => s.toLowerCase() === player.name.toLowerCase()
                          );
                          const leaderboardPlayer = leaderboard.find(
                            p => p.name.toLowerCase() === player.name.toLowerCase()
                          );
                          const starterData = teamStanding?.starters?.find(
                            s => s.name.toLowerCase() === player.name.toLowerCase()
                          );
                          
                          const isCut = leaderboardPlayer?.isCut;
                          const isWD = leaderboardPlayer?.isWD;
                          const isDQ = leaderboardPlayer?.isDQ;
                          const hasPenalty = starterData?.penaltyApplied;
                          
                          return (
                            <div key={idx} className="roster-player" style={
                              hasPenalty ? { background: 'rgba(255, 71, 87, 0.1)', borderColor: 'var(--accent-red)' } : {}
                            }>
                              <div className="roster-player-info">
                                <div className={`starter-indicator ${isStarter ? 'active' : ''}`} 
                                     style={hasPenalty ? { background: 'var(--accent-red)' } : {}}></div>
                                <div>
                                  <div className="roster-player-name" style={hasPenalty ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : {}}>
                                    {player.name}
                                    {isCut && <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--accent-red)' }}>MC</span>}
                                    {isWD && <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--accent-orange)' }}>WD</span>}
                                    {isDQ && <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--accent-orange)' }}>DQ</span>}
                                  </div>
                                  <div className="roster-player-round">
                                    Round {player.round}
                                    {hasPenalty && (
                                      <span style={{ marginLeft: '8px', color: 'var(--accent-red)', fontSize: '10px' }}>
                                        Penalty: +{hasPenalty.penalty > 0 ? hasPenalty.penalty : hasPenalty.penalty}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isStarter && starterData && (
                                <div className={`roster-player-score`} style={{
                                  color: hasPenalty ? 'var(--accent-red)' : 
                                         parseInt(starterData.score) < 0 ? 'var(--accent-green)' : 'var(--text-primary)'
                                }}>
                                  {starterData.score}
                                  {hasPenalty && starterData.originalScore !== starterData.score && (
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                      was {starterData.originalScore}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {(!roster?.players || roster.players.length === 0) && (
                          <div className="empty-state" style={{ padding: '20px' }}>
                            <p>No players drafted yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'standings' && (
            <>
              <div className="tournament-header">
                <div className="tournament-info">
                  <h1>Season Standings</h1>
                  <div className="tournament-meta">
                    <span>Points race for 2026</span>
                  </div>
                </div>
                <div className="season-toggle">
                  <button 
                    className={`season-btn ${selectedSeason === 1 ? 'active' : ''}`}
                    onClick={() => setSelectedSeason(1)}
                  >
                    Season 1
                  </button>
                  <button 
                    className={`season-btn ${selectedSeason === 2 ? 'active' : ''}`}
                    onClick={() => setSelectedSeason(2)}
                  >
                    Season 2
                  </button>
                </div>
              </div>

              <div className="card">
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team</th>
                      <th>Points</th>
                      <th>T1</th>
                      <th>T2</th>
                      <th>T3</th>
                      <th>T4</th>
                      <th>T5</th>
                      <th>T6</th>
                      <th>T7</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEAGUE_CONFIG.teams.map((team, idx) => (
                      <tr key={team.id}>
                        <td className="rank">{idx + 1}</td>
                        <td style={{ fontWeight: 500 }}>{team.name}</td>
                        <td style={{ 
                          fontFamily: 'JetBrains Mono', 
                          fontWeight: 600,
                          color: 'var(--accent-green)' 
                        }}>
                          0
                        </td>
                        {[1, 2, 3, 4, 5, 6, 7].map(t => (
                          <td key={t} style={{ color: 'var(--text-muted)' }}>-</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '32px' }}>
                <h2 style={{ marginBottom: '16px' }}>Tournament Schedule</h2>
                <div className="card">
                  <table className="standings-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Tournament</th>
                        <th>Dates</th>
                        <th>Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedSeason === 1 ? LEAGUE_CONFIG.season1Tournaments : LEAGUE_CONFIG.season2Tournaments)
                        .map((t, idx) => (
                          <tr key={idx}>
                            <td className="rank">{idx + 1}</td>
                            <td style={{ fontWeight: 500 }}>{t.name}</td>
                            <td>{t.dates}</td>
                            <td>
                              {t.isMajor ? (
                                <span style={{ 
                                  color: 'var(--accent-gold)',
                                  fontWeight: 600 
                                }}>
                                  ⭐ Major (2x)
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Regular</span>
                              )}
                            </td>
                            <td style={{ color: 'var(--text-muted)' }}>Upcoming</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'commissioner' && isCommissioner && (
            <>
              <div className="tournament-header">
                <div className="tournament-info">
                  <h1>⚙️ Commissioner Panel</h1>
                  <div className="tournament-meta">
                    <span>Manage draft results, rosters, and weekly lineups</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '24px' }}>
                {/* Draft Results Entry */}
                <div className="card commissioner-card">
                  <div className="card-header commissioner-header">
                    <div className="card-title">📝 Enter Draft Results</div>
                  </div>
                  <div className="commissioner-panel">
                    <div className="form-group">
                      <label className="form-label">Select Team</label>
                      <select 
                        className="form-select"
                        value={selectedTeamForEdit}
                        onChange={e => setSelectedTeamForEdit(parseInt(e.target.value))}
                      >
                        {LEAGUE_CONFIG.teams.map(team => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="roster-editor">
                      <div>
                        <h4 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                          Add Player to {LEAGUE_CONFIG.teams.find(t => t.id === selectedTeamForEdit)?.name}'s Roster
                        </h4>
                        
                        <div className="form-group">
                          <label className="form-label">Search Player</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Type player name..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                          />
                        </div>

                        {searchQuery && (
                          <div className="player-search-results">
                            {PGA_PLAYERS
                              .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                              .slice(0, 15)
                              .map(player => {
                                // Check if already drafted
                                let draftedBy = null;
                                for (const [tid, roster] of Object.entries(rosters)) {
                                  if (roster.players?.some(p => p.name.toLowerCase() === player.name.toLowerCase())) {
                                    draftedBy = LEAGUE_CONFIG.teams.find(t => t.id === parseInt(tid));
                                    break;
                                  }
                                }
                                
                                return (
                                  <div key={player.name} className="player-search-item">
                                    <div>
                                      <div style={{ fontWeight: 500 }}>{player.name}</div>
                                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        OWGR #{player.rank}
                                        {draftedBy && (
                                          <span style={{ color: 'var(--accent-red)', marginLeft: '8px' }}>
                                            • Drafted by {draftedBy.name}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {!draftedBy && (
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        {[1,2,3,4,5,6,7].map(round => (
                                          <button
                                            key={round}
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => {
                                              addPlayerToRoster(selectedTeamForEdit, player.name, round);
                                              setSearchQuery('');
                                            }}
                                            title={`Add as Round ${round} pick`}
                                          >
                                            R{round}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            {PGA_PLAYERS.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No players found. Try a different search term.
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="roster-list">
                        <h4>
                          Current Roster ({rosters[selectedTeamForEdit]?.players?.length || 0}/7)
                        </h4>
                        {(rosters[selectedTeamForEdit]?.players || [])
                          .sort((a, b) => a.round - b.round)
                          .map((player, idx) => (
                            <div key={idx} className="roster-item">
                              <div className="roster-item-info">
                                <span className="roster-item-round">R{player.round}</span>
                                <span className="roster-item-name">{player.name}</span>
                              </div>
                              <div className="roster-item-actions">
                                <button 
                                  className="icon-btn remove"
                                  onClick={() => removePlayerFromRoster(selectedTeamForEdit, player.name)}
                                  title="Remove from roster"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        {(!rosters[selectedTeamForEdit]?.players?.length) && (
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                            No players on roster
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Weekly Lineups */}
                <div className="card commissioner-card">
                  <div className="card-header commissioner-header">
                    <div className="card-title">📋 Set Weekly Lineups</div>
                    <select 
                      className="form-select" 
                      style={{ width: 'auto' }}
                      value={selectedTournament}
                      onChange={e => setSelectedTournament(e.target.value)}
                    >
                      <optgroup label="Season 1">
                        {LEAGUE_CONFIG.season1Tournaments.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.isMajor ? '⭐' : ''}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Season 2">
                        {LEAGUE_CONFIG.season2Tournaments.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.isMajor ? '⭐' : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="commissioner-panel">
                    <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                      {currentTournamentConfig?.isMajor 
                        ? '⭐ Major Tournament: Select 6 starters per team'
                        : 'Regular Tournament: Select 4 starters per team'}
                    </p>
                    
                    <div className="lineup-editor">
                      {LEAGUE_CONFIG.teams.map(team => {
                        const roster = rosters[team.id];
                        const starters = getTeamStarters(team.id);
                        const maxStarters = currentTournamentConfig?.isMajor ? 6 : 4;
                        
                        return (
                          <div key={team.id} className="lineup-team-card">
                            <div className="lineup-team-header">
                              <div className="lineup-team-name">{team.name}</div>
                              <div className="lineup-count" style={{
                                color: starters.length === maxStarters ? 'var(--accent-green)' : 'var(--text-muted)'
                              }}>
                                {starters.length}/{maxStarters}
                              </div>
                            </div>
                            
                            {(roster?.players || []).map((player, idx) => {
                              const isStarter = starters.some(
                                s => s.toLowerCase() === player.name.toLowerCase()
                              );
                              
                              return (
                                <div key={idx} className="lineup-player">
                                  <input
                                    type="checkbox"
                                    className="lineup-checkbox"
                                    checked={isStarter}
                                    onChange={() => toggleStarter(team.id, player.name)}
                                  />
                                  <span className={`lineup-player-name ${isStarter ? 'starter' : ''}`}>
                                    {player.name}
                                  </span>
                                </div>
                              );
                            })}
                            
                            {/* Show existing rentals */}
                            {getTeamRentals(selectedTournament, team.id).map((rentalName, idx) => {
                              const isStarter = starters.some(
                                s => s.toLowerCase() === rentalName.toLowerCase()
                              );
                              return (
                                <div key={`rental-${idx}`} className="lineup-player" style={{ background: 'rgba(0, 212, 255, 0.1)', borderRadius: '6px', padding: '4px 8px', margin: '2px 0' }}>
                                  <input
                                    type="checkbox"
                                    className="lineup-checkbox"
                                    checked={isStarter}
                                    onChange={() => toggleStarter(team.id, rentalName)}
                                  />
                                  <span className={`lineup-player-name ${isStarter ? 'starter' : ''}`} style={{ color: 'var(--accent-blue)' }}>
                                    {rentalName} <span style={{ fontSize: '10px', opacity: 0.7 }}>(RENTAL)</span>
                                  </span>
                                  <button 
                                    className="icon-btn remove"
                                    style={{ marginLeft: 'auto', width: '20px', height: '20px', fontSize: '10px' }}
                                    onClick={() => removeRentalPlayer(selectedTournament, team.id, rentalName)}
                                    title="Remove rental"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                            
                            {(!roster?.players?.length && getTeamRentals(selectedTournament, team.id).length === 0) && (
                              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                No players on roster
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Rental Players */}
                <div className="card commissioner-card">
                  <div className="card-header commissioner-header">
                    <div className="card-title">🔄 Add Rental Players</div>
                  </div>
                  <div className="commissioner-panel">
                    <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                      Add rental players for teams that can't field a full lineup. Rentals are temporary for the selected tournament only.
                    </p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Tournament</label>
                        <select 
                          className="form-select"
                          value={selectedTournament}
                          onChange={e => setSelectedTournament(e.target.value)}
                        >
                          <optgroup label="Season 1">
                            {LEAGUE_CONFIG.season1Tournaments.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Season 2">
                            {LEAGUE_CONFIG.season2Tournaments.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Team</label>
                        <select 
                          className="form-select"
                          value={selectedTeamForRental}
                          onChange={e => setSelectedTeamForRental(parseInt(e.target.value))}
                        >
                          {LEAGUE_CONFIG.teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Search Player to Rent</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Type player name..."
                        value={rentalSearchQuery}
                        onChange={e => setRentalSearchQuery(e.target.value)}
                      />
                    </div>

                    {rentalSearchQuery && (
                      <div className="player-search-results" style={{ maxHeight: '200px' }}>
                        {PGA_PLAYERS
                          .filter(p => p.name.toLowerCase().includes(rentalSearchQuery.toLowerCase()))
                          .slice(0, 10)
                          .map(player => {
                            // Check if already on a roster
                            let onRoster = null;
                            for (const [tid, roster] of Object.entries(rosters)) {
                              if (roster.players?.some(p => p.name.toLowerCase() === player.name.toLowerCase())) {
                                onRoster = LEAGUE_CONFIG.teams.find(t => t.id === parseInt(tid));
                                break;
                              }
                            }
                            
                            // Check if already a rental for this team this tournament
                            const isAlreadyRental = getTeamRentals(selectedTournament, selectedTeamForRental)
                              .some(r => r.toLowerCase() === player.name.toLowerCase());
                            
                            return (
                              <div key={player.name} className="player-search-item">
                                <div>
                                  <div style={{ fontWeight: 500 }}>{player.name}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    OWGR #{player.rank}
                                    {onRoster && (
                                      <span style={{ color: 'var(--accent-orange)', marginLeft: '8px' }}>
                                        • On {onRoster.name}'s roster
                                      </span>
                                    )}
                                    {isAlreadyRental && (
                                      <span style={{ color: 'var(--accent-blue)', marginLeft: '8px' }}>
                                        • Already rental
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {!isAlreadyRental && (
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: 'var(--accent-blue)', color: 'var(--bg-primary)' }}
                                    onClick={() => {
                                      addRentalPlayer(selectedTournament, selectedTeamForRental, player.name);
                                      setRentalSearchQuery('');
                                    }}
                                  >
                                    Add Rental
                                  </button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Show current rentals for selected team */}
                    {getTeamRentals(selectedTournament, selectedTeamForRental).length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Current Rentals for {LEAGUE_CONFIG.teams.find(t => t.id === selectedTeamForRental)?.name}:
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {getTeamRentals(selectedTournament, selectedTeamForRental).map((name, idx) => (
                            <span key={idx} style={{
                              padding: '6px 12px',
                              background: 'rgba(0, 212, 255, 0.15)',
                              border: '1px solid rgba(0, 212, 255, 0.3)',
                              borderRadius: '6px',
                              fontSize: '13px',
                              color: 'var(--accent-blue)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              {name}
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-red)',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  padding: 0
                                }}
                                onClick={() => removeRentalPlayer(selectedTournament, selectedTeamForRental, name)}
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
