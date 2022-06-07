export function clickOutside(node) {
    const handleClick = (event) => {
        if (node && !node.parentElement.contains(event.target) && !event.defaultPrevented) {
            node.dispatchEvent(new CustomEvent("clickOutside", node));
        }
    };

    document.addEventListener("click", handleClick, true);

    return {
        destroy() {
            document.removeEventListener("click", handleClick, true);
        },
    };
}
