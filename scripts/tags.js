// tags
const elements = [...document.getElementsByClassName("postn"), ...document.getElementsByClassName("post")]; // prefetch - make global
const tagMessageElement = document.getElementById("tagMessage");

let start = performance.now();

initCheck(); // if the page is loaded with a tag in the URL
addExtraData(); // run to get <div class="blog"> and paste it in the relevant page (faster than loading every page load)

tagMessageElement.innerHTML = `<article class="sheen"><blockquote class="blank">Took ${performance.now() - start} ms to compile.</blockquote></article>`; // display tag text

window.addEventListener("hashchange", function () {
    initCheck();
    window.scrollTo(0, 0); // scroll page to the top
}, false);

function initCheck() {
    if (window.location.hash.length > 1) checkTags();
}

function tagUI() {
    tagMessageElement.innerHTML = `<article class="sheen"><blockquote class="blank">Showing posts with the <b>${window.location.hash.substring(1)}</b> tag | <a href="#" onclick="clearTags()">Clear selection</a></blockquote></article>`; // display tag text
}

function checkTags() {
    console.log("Tag detected in URL");
    tagUI(); // show the tag search box
    let emptyPage = true; // for the error message, if a post is not hidden, emptyPage will become false (through checkTagsInPost())
    let i = elements.length; // elements returns an array, start at array length then iterate through divs downwards
    while (i--) {
        emptyPage = checkTagsInPost(elements, i, emptyPage); // iterate through posts hiding them if they don't have the searched for tag
    }
    if (emptyPage) { // display tag text for an empty page
        tagMessageElement.innerHTML = `<article class="sheen"><blockquote class="blank">There are no pages with the <b>${window.location.hash.substring(1)}</b> tag... | <a href="#" onclick="clearTags()">Clear selection</a></blockquote></article>`;
    }
}

function checkTagsInPost(elements, i, emptyPage) {
    const element = elements[i];
    element.classList.remove("hidden"); // show hidden posts (reset their state)
    const temp = element.getElementsByTagName("span")[1].getElementsByClassName("tag"); // index 0 is date, 1 is tags
    const tags = Array.from(temp).map((tag) => tag.textContent);
    if (!tags.includes(window.location.hash.substring(1))) {
        element.classList.add("hidden"); // hide post if tags array don't contain the hash
    } else {
        emptyPage = false;
    }
    return emptyPage;
}

function clearTags() {
    console.log("Clearing tag");
    let i = elements.length; // elements returns an array, start at array length then iterate through divs downwards
    while (i--) {
        elements[i].classList.remove("hidden");
    }
    tagMessageElement.innerHTML = "";
}

// search
const searchBar = document.getElementById("search");
searchBar.classList.remove("hidden");
searchBar.addEventListener("input", search); // listen to search bar
if (searchBar.value) search(); // for going back a page, search immediately

function search() {
    const rawInput = searchBar.value;
    const input = rawInput.toLowerCase(); // make searching not case-sensitive

    tagMessageElement.innerHTML = `<article class="sheen"><blockquote class="blank">Searching for <b>${rawInput}</b> | <a href="#" onclick="clearSearch()">Clear search</a></blockquote></article>`; // display search text
    if (input.length < 1) tagMessageElement.innerHTML = ``; // empty search
    for (let i = 0; i < elements.length; i++) {
        // loop through each post
        // combine to text string and search
        const text = elements[i].getElementsByClassName("desc")[0].getAttribute("data");
        if (text.toLowerCase().indexOf(input) > -1) {
            elements[i].classList.remove("hidden");
        } else {
            elements[i].classList.add("hidden");
        }
    }
}

function clearSearch() {
    searchBar.value = "";
    search();
}

function addExtraData() {
    // prefill elements with searchable data
    for (const element of elements) {
        // dates
        let dateWords; // add 'months' in words to search (combinations like "July", "July 2022", "2022 July")
        const dateOfPost = element.getElementsByTagName("span")[0].innerHTML; // index 0 of "span" is date, 1 is tags
        const temp = dateOfPost.split(" "); // some dates have times included in them
        const dateSegments = temp.length > 1 ? temp[1].split("-") : temp[0].split("-");

        // month name
        let monthName;
        const date = new Date();
        date.setMonth(dateSegments[1] - 1);
        if (date != "Invalid Date") { // for that one post with "???????" as the date
            monthName = date.toLocaleString("en-US", { month: "long" }); // english
        }

        // combination
        if (monthName) dateWords = `${monthName} ${dateSegments[0]} ${monthName}`;

        // tags
        const tempTags = element.getElementsByTagName("span")[1].getElementsByClassName("tag"); // index 0 of "span" is date, 1 is tags
        const tags = Array.from(tempTags).map((tag) => tag.textContent);

        // add data
        const descElements = element.getElementsByClassName("desc");
        const titleElements = element.getElementsByClassName("title");
        let imageAlt = ""
        if (element.getElementsByClassName("image")[0]) imageAlt = element.getElementsByClassName("image")[0].firstChild.alt;
        if (!imageAlt) imageAlt = ""

        if (descElements.length > 0 && titleElements.length > 0) {
            descElements[0].setAttribute("data",
                `${titleElements[0].innerHTML} ${descElements[0].innerHTML} ${imageAlt} ${tags.toString()} ${dateOfPost} ${dateWords} `
            );
        } else if (titleElements.length > 0) {
            const newDescElement = document.createElement("div");
            newDescElement.className = "desc";
            newDescElement.setAttribute("data",
                `${titleElements[0].innerHTML} ${dateOfPost} ${dateWords} ${tags.toString()}`
            );
            element.appendChild(newDescElement);
        }
    }
    console.log(document.getElementsByClassName("blog")[0].innerHTML)
}