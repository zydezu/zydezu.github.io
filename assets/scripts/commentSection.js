// correct comment section box height
const frame = document.getElementById("commentSection");
window.addEventListener('message', function (event) {
    console.log(event.data)
    frame.height = event.data
});