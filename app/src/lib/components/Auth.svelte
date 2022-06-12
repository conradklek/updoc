<script>
    import { app } from "$lib/stores"
    import { createEventDispatcher } from "svelte"
    const dispatch = createEventDispatcher()
    async function signUp(e) {
        let data = new FormData(e.target)
        const email = data.get("email")
        const name = data.get("name")
        const password = data.get("password")
        const newUser = await app.post({ name, email, password })
        if (!newUser) return
        const user = await app.login({ email, password })
        if (!user) return
        app.set([user])
        return dispatch("post")
    }
    async function signIn(e) {
        let data = new FormData(e.target)
        const email = data.get("email")
        const password = data.get("password")
        const user = await app.login({ email, password })
        if (!user) return
        app.set([user])
        return dispatch("post")
    }
</script>

<main id="auth">
    <form on:submit|preventDefault={signIn}>
        <h1>Sign In</h1>
        <div>
            <input name="email" type="email" id="userEmail" />
            <label for="userEmail">Email</label>
        </div>
        <div>
            <input name="password" type="password" id="userPassword" />
            <label for="userPassword">Password</label>
        </div>
        <button>Enter</button>
    </form>
    <form on:submit|preventDefault={signUp}>
        <h1>Sign Up</h1>
        <div>
            <input name="email" type="email" id="email" />
            <label for="email">Email</label>
        </div>
        <div>
            <input name="name" type="text" id="name" />
            <label for="name">Username</label>
        </div>
        <div>
            <input name="password" type="password" id="password" />
            <label for="password">Password</label>
        </div>
        <button>Submit</button>
    </form>
</main>

<style lang="postcss">
    main#auth {
        @apply flex flex-row items-start justify-center gap-6 pt-4 py-12;
    }
    main#auth > form {
        @apply inline-flex flex-col items-start justify-start w-44;
    }
    main#auth > form > h1 {
        @apply mt-4 text-3xl font-bold;
    }
    main#auth > form > div {
        @apply grid;
        grid-template-rows: repeat(2, auto);
        grid-template-columns: auto;
        grid-template-areas: "label" "input";
    }
    main#auth > form > div > label {
        grid-area: label;
        @apply block mt-2 py-1 font-semibold;
    }
    main#auth > form > div > input {
        grid-area: input;
        @apply block w-full px-2 py-1 text-sm font-medium rounded-sm;
    }
    main#auth > form > div > input:focus + label {
        @apply text-blue-700;
    }
    main#auth > form > div > input,
    main#auth > form > button {
        @apply transition-colors duration-200;
    }
    main#auth > form > div > input:focus,
    main#auth > form > button:focus {
        @apply outline outline-2 outline-blue-600 outline-offset-0;
    }
    main#auth > form > button {
        @apply block ml-auto mt-4 px-3 py-1 bg-slate-200 font-semibold rounded-sm transition-colors duration-200;
    }
    main#auth > form > button:focus {
        @apply bg-slate-50;
    }
</style>