const blogPosts = [
    {
        title: "Simplified Debugging for FastAPI in Docker",
        date: "Oct 14, 2025",
        url: "https://medium.com/@suresh2692/simplified-debugging-for-fastapi-in-docker-using-vs-code-no-more-exposed-ports-or-extra-debug-code-9ca75dacc395",
        image: "https://miro.medium.com/v2/resize:fill:640:360/1*dmbNkD5D-u45r44go_cf0g.png"
    },
    {
        title: "LLM Chatbot Series — Part 2: Baseline for Prompts",
        date: "Jul 18, 2025",
        url: "https://medium.com/@suresh2692/llm-chatbot-series-part-2-7efd5b31daab",
        image: "https://miro.medium.com/v2/resize:fill:640:360/0*XkS9gkNDk63QH-_j"
    },
    {
        title: "LLM Chatbot Series — Part 1: What Is an AI Agent?",
        date: "Jul 17, 2025",
        url: "https://medium.com/@suresh2692/llm-chatbot-part-1-f0b547fab1fa",
        image: "https://miro.medium.com/v2/resize:fill:640:360/0*XkS9gkNDk63QH-_j"
    },
    {
        title: "FastAPI in Action: Seamlessly Deploy ML Models",
        date: "Jan 10, 2025",
        url: "https://medium.com/@suresh2692/fastapi-in-action-seamlessly-deploy-and-scale-multiple-ml-models-in-production-d688f92ff8ce",
        image: "https://miro.medium.com/v2/resize:fill:640:360/0*XkS9gkNDk63QH-_j"
    },
    {
        title: "Kubernetes Architecture: High Level Components",
        date: "Sep 11, 2024",
        url: "https://medium.com/@suresh2692/kubernetes-architecture-f7c254cae9cf",
        image: "https://miro.medium.com/v2/resize:fill:640:360/1*-Vm_rWA-I5UPT-f36EvqFg.png"
    },
    {
        title: "Docker to Kubernetes: A Visual Guide",
        date: "Aug 24, 2024",
        url: "https://medium.com/@suresh2692/docker-to-kubernetes-a-visual-guide-to-translating-docker-components-in-kubernetes-f8df5db2ef88",
        image: "https://miro.medium.com/v2/resize:fill:640:360/1*LNBD7-DmqFtXntZQsr9yYg.png"
    }
];

function renderProjects() {
    const projectsContainer = document.getElementById('projects-grid');
    if (!projectsContainer) return;

    projectsContainer.innerHTML = blogPosts.map(post => `
        <a href="${post.url}" class="grid-item blog-item" style="--bg-image: url('${post.image}')">
            <span class="blog-title">${post.title}</span>
            <span class="blog-date">${post.date}</span>
        </a>
    `).join('');
}

document.addEventListener('DOMContentLoaded', renderProjects);
