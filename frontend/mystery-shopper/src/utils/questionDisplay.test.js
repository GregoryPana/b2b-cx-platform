import { describe, it, expect } from "vitest";
import { computeDisplayNumber, buildDisplayNumbers } from "./questionDisplay.js";

// The 27 mystery shopper questions in their new display order.
// Group order: External Environment (1-5) → Store Environment & Comfort (6-10)
// → Staff Appearance & Professionalism (11-14) → Customer Service Interaction (15-21)
// → Time & Efficiency (22-23) → Overall Experience (24-27)
const MYSTERY_QUESTIONS = [
  { id: 1,  question_number: 2001, question_text: "How is Signage visibility & cleanliness" },
  { id: 2,  question_number: 2002, question_text: "How is Store entrance cleanliness" },
  { id: 3,  question_number: 2003, question_text: "Rate the display of Promotional materials" },
  { id: 4,  question_number: 2004, question_text: "Greeted within 30 seconds" },
  { id: 5,  question_number: 2005, question_text: "Greeting polite & warm" },
  { id: 17, question_number: 2006, question_text: "Cleanliness of store" },
  { id: 18, question_number: 2007, question_text: "Queue management" },
  { id: 19, question_number: 2008, question_text: "Display organisation and posters" },
  { id: 20, question_number: 2009, question_text: "Air conditioning / ventilation" },
  { id: 21, question_number: 2010, question_text: "Space & comfort" },
  { id: 6,  question_number: 2011, question_text: "Are staff Uniform neat and complete" },
  { id: 7,  question_number: 2012, question_text: "How is the staff Personal grooming" },
  { id: 8,  question_number: 2013, question_text: "Rate the Name badge visibility" },
  { id: 9,  question_number: 2014, question_text: "Do staff act with Professional behaviour" },
  { id: 10, question_number: 2015, question_text: "Did staff listen actively" },
  { id: 11, question_number: 2016, question_text: "Did staff Ask relevant questions" },
  { id: 12, question_number: 2017, question_text: "Rate Staff Product/service knowledge" },
  { id: 13, question_number: 2018, question_text: "How was the Accuracy of information Provided" },
  { id: 14, question_number: 2019, question_text: "Handled clarifying questions" },
  { id: 15, question_number: 2020, question_text: "Was a Solution provided" },
  { id: 16, question_number: 2021, question_text: "Was the Solution helpful" },
  { id: 22, question_number: 2022, question_text: "Waiting time" },
  { id: 23, question_number: 2023, question_text: "Service completion (handling time)" },
  { id: 24, question_number: 2024, question_text: "Staff interaction satisfaction" },
  { id: 25, question_number: 2025, question_text: "Store environment satisfaction" },
  { id: 26, question_number: 2026, question_text: "NPS - Recommend this outlet" },
  { id: 27, question_number: 2027, question_text: "Final comments / recommendations" },
];

describe("computeDisplayNumber", () => {
  it("converts DB question_number 2001-2027 to display numbers 1-27", () => {
    for (let i = 0; i < MYSTERY_QUESTIONS.length; i++) {
      const q = MYSTERY_QUESTIONS[i];
      expect(computeDisplayNumber(q.question_number)).toBe(i + 1);
    }
  });

  it("returns fallbackIndex+1 when question_number is missing", () => {
    expect(computeDisplayNumber(null, 0)).toBe(1);
    expect(computeDisplayNumber(undefined, 4)).toBe(5);
    expect(computeDisplayNumber(NaN, 2)).toBe(3);
  });

  it("passes through positive numbers below 1000 unchanged", () => {
    expect(computeDisplayNumber(1)).toBe(1);
    expect(computeDisplayNumber(27)).toBe(27);
    expect(computeDisplayNumber(999)).toBe(999);
  });
});

describe("buildDisplayNumbers (questionDisplayNumbers memo)", () => {
  it("assigns display numbers 1 through 27 to all mystery shopper questions", () => {
    const map = buildDisplayNumbers(MYSTERY_QUESTIONS);
    const displayValues = Object.values(map).sort((a, b) => a - b);
    // Exactly 27 questions
    expect(displayValues).toHaveLength(27);
    // Numbers are exactly 1..27 with no gaps or duplicates
    expect(displayValues).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
  });

  it("maps each question id to the correct sequential position", () => {
    const map = buildDisplayNumbers(MYSTERY_QUESTIONS);
    MYSTERY_QUESTIONS.forEach((q, i) => {
      expect(map[q.id]).toBe(i + 1);
    });
  });

  it("handles questions provided in random order and still produces 1-27", () => {
    const shuffled = [...MYSTERY_QUESTIONS].sort(() => Math.random() - 0.5);
    const map = buildDisplayNumbers(shuffled);
    // Each question gets its correct position regardless of input order
    MYSTERY_QUESTIONS.forEach((q, i) => {
      expect(map[q.id]).toBe(i + 1);
    });
  });

  it("all 27 questions are present — none missing", () => {
    const map = buildDisplayNumbers(MYSTERY_QUESTIONS);
    MYSTERY_QUESTIONS.forEach((q) => {
      expect(map[q.id]).toBeDefined();
    });
  });

  it("Store Environment & Comfort questions are numbered 6-10", () => {
    const map = buildDisplayNumbers(MYSTERY_QUESTIONS);
    const storeEnvIds = MYSTERY_QUESTIONS.filter((q) => q.question_number >= 2006 && q.question_number <= 2010).map((q) => q.id);
    const storeEnvDisplayNums = storeEnvIds.map((id) => map[id]).sort((a, b) => a - b);
    expect(storeEnvDisplayNums).toEqual([6, 7, 8, 9, 10]);
  });

  it("Staff Appearance & Professionalism questions are numbered 11-14", () => {
    const map = buildDisplayNumbers(MYSTERY_QUESTIONS);
    const staffIds = MYSTERY_QUESTIONS.filter((q) => q.question_number >= 2011 && q.question_number <= 2014).map((q) => q.id);
    const staffDisplayNums = staffIds.map((id) => map[id]).sort((a, b) => a - b);
    expect(staffDisplayNums).toEqual([11, 12, 13, 14]);
  });

  it("Customer Service Interaction questions are numbered 15-21", () => {
    const map = buildDisplayNumbers(MYSTERY_QUESTIONS);
    const csiIds = MYSTERY_QUESTIONS.filter((q) => q.question_number >= 2015 && q.question_number <= 2021).map((q) => q.id);
    const csiDisplayNums = csiIds.map((id) => map[id]).sort((a, b) => a - b);
    expect(csiDisplayNums).toEqual([15, 16, 17, 18, 19, 20, 21]);
  });
});
