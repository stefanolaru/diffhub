const expect = require("expect");

async function toBePresent(selector, page, is_visible = false) {
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

async function elementAttribute(
    selector,
    page,
    attribute,
    matcher,
    value = null
) {
    const attr = await page.evaluate(
        (selector, attribute) => {
            const el = document.querySelector(selector);
            // otherwise return the get attribute
            return el ? el.getAttribute(attribute) : !!el;
        },
        selector,
        attribute
    );

    let pass = true;

    //
    try {
        matcher.startsWith("not.")
            ? expect(attr).not[matcher.replace("not.", "")](value)
            : expect(attr)[matcher](value);
    } catch (e) {
        pass = false;
    }

    return {
        message: () =>
            pass
                ? "Attribute matches condition."
                : "Attribute does not match condition.",
        pass: pass,
    };
}

async function styleProperty(selector, page, property, matcher, value = null) {
    const propval = await page.evaluate(
        (selector, property) => {
            const el = document.querySelector(selector);
            return window.getComputedStyle(el).getPropertyValue(property);
        },
        selector,
        property
    );

    console.log(propval);

    let pass = true;

    //
    try {
        matcher.startsWith("not.")
            ? expect(propval).not[matcher.replace("not.", "")](value)
            : expect(propval)[matcher](value);
    } catch (e) {
        pass = false;
    }

    return {
        message: () =>
            pass
                ? "Style property matches condition."
                : "Style property does not match condition.",
        pass: pass,
    };
}

async function textContent(selector, page, matcher, value = null) {
    const text = await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerText.trim() : !!el;
    }, selector);

    let pass = true;

    //
    try {
        matcher.startsWith("not.")
            ? expect(text).not[matcher.replace("not.", "")](value)
            : expect(text)[matcher](value);
    } catch (e) {
        pass = false;
    }

    return {
        message: () =>
            pass
                ? "Text content matches condition."
                : "Text does not match condition.",
        pass: pass,
    };
}

module.exports = {
    toBePresent,
    toBeVisible,
    elementAttribute,
    styleProperty,
    textContent,
};
