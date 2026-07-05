import assert from "node:assert/strict";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const { getStyleProperty } = load("../src/styles/properties.ts");
const {
	getCssStyleValue,
	validateStyleValue,
} = load("../src/validation.ts");

const tests = [
	{
		name: "padding number fields are measured in pixels",
		run() {
			const definition = getStyleProperty("padding-left");

			assert.equal(definition.range?.unit, "px");
			assert.equal(definition.range?.cssUnit, undefined);
			assert.equal(definition.range?.cssMultiplier, undefined);
			assert.deepEqual(validateStyleValue("padding-left", "12"), {
				valid: true,
				value: "12px",
			});
			assert.equal(getCssStyleValue("padding-left", "12px"), "12px");
		},
	},
	{
		name: "margin number fields allow negative pixel offsets",
		run() {
			const definition = getStyleProperty("margin-left");

			assert.equal(definition.range?.min, -100);
			assert.equal(definition.range?.max, 100);
			assert.deepEqual(validateStyleValue("margin-left", "-12"), {
				valid: true,
				value: "-12px",
			});
			assert.equal(getCssStyleValue("margin-left", "-12px"), "-12px");
		},
	},
	{
		name: "line radius is a selectable pixel value for both line types",
		run() {
			const definition = getStyleProperty("--fancify-line-radius");

			assert.deepEqual(definition.styleType, [
				"horizontal-line",
				"vertical-line",
			]);
			assert.equal(definition.range?.max, 100);
			assert.deepEqual(validateStyleValue("--fancify-line-radius", "8"), {
				valid: true,
				value: "8px",
			});
			assert.equal(getCssStyleValue("--fancify-line-radius", "8px"), "8px");
		},
	},
	{
		name: "number inputs allow one-step values with coarser slider steps",
		run() {
			const definition = getStyleProperty("--fancify-line-length");

			assert.equal(definition.range?.step, 1);
			assert.equal(definition.range?.sliderStep, 10);
			assert.deepEqual(validateStyleValue("--fancify-line-length", "37"), {
				valid: true,
				value: "37%",
			});
		},
	},
	{
		name: "select properties expose real defaults instead of not set",
		run() {
			assert.equal(getStyleProperty("font-weight").defaultValue, "400");
			assert.deepEqual(getStyleProperty("font-weight").options, [
				"400",
				"100",
				"200",
				"300",
				"500",
				"600",
				"700",
				"800",
				"900",
			]);
			assert.equal(getStyleProperty("outline-style").defaultValue, "none");
			assert.equal(getStyleProperty("border-style").defaultValue, "none");
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} validation checks.`);
