<script lang="ts">
  import ChatWidget from '$lib/components/ChatWidget.svelte';
</script>

<svelte:head>
  <meta
    name="description"
    content="CozyNest Home Goods — AI-powered customer support chat"
  />
</svelte:head>

<main>
  <div class="hero">
    <h1>CozyNest Home Goods</h1>
    <p class="tagline">Beautiful home essentials, delivered with care.</p>
  </div>

  <div class="chat-container">
    <ChatWidget />
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: 'Inter', system-ui, sans-serif;
    background: linear-gradient(160deg, #d8f3dc 0%, #b7e4c7 40%, #95d5b2 100%);
    min-height: 100vh;
  }

  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px 16px;
    gap: 24px;
  }

  .hero {
    text-align: center;
    color: #1b4332;
  }

  .hero h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
  }

  .tagline {
    margin: 6px 0 0;
    font-size: 15px;
    opacity: 0.75;
  }

  .chat-container {
    width: 100%;
    max-width: 420px;
    height: 600px;
  }
</style>
