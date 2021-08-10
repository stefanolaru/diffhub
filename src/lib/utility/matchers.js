const expect = require("expect");

// expect(selector).toMatch(context, val)

async function toBePresent(selector, page, is_visible = false) {
    // console.log(selector);
    const pass = await page.evaluate(
        (selector, is_visible) => {
            const el = document.querySelector(selector);
            // element not present
            if (!el) return false;

            // check for visibility
            if (is_visible === true) {
                // check if it's visible, get computed style
                const style = window.getComputedStyle(el);
                return (
                    style &&
                    style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    style.opacity !== "0"
                );
            }
            //
            return !!el;
        },
        selector,
        is_visible
    );

    return {
        message: () => (pass ? "Element was found" : "Element not found."),
        pass: pass,
    };
}
// toBePresent shorthand
async function toBeVisible(selector, page) {
    const { pass } = await toBePresent(selector, page, true);
    return {
        message: () =>
            pass ? "Element is visible" : "Element is not visible.",
        pass: pass,
    };
}

module.exports = {
    toBePresent,
    toBeVisible,
};
