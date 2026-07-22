<script setup lang="ts">
const { signIn } = useAuth()
const toast = useToast()

const form = ref({ email: '', password: '' })
const loading = ref(false)

async function handleLogin() {
  loading.value = true
  const { error } = await signIn.email({ email: form.value.email, password: form.value.password })
  loading.value = false

  if (error) {
    toast.add({ title: error.message || 'Invalid credentials', color: 'error', icon: 'i-lucide-circle-x' })
    return
  }

  return navigateTo('/')
}
</script>

<template>
  <div class="flex h-screen items-center justify-center">
    <UCard class="w-full max-w-sm">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-shield" class="text-primary size-5" />
          <span class="text-lg font-bold">Fortify</span>
        </div>
        <p class="text-dimmed mt-1 text-sm">
          Sign in to your account
        </p>
      </template>

      <form class="flex flex-col gap-4" @submit.prevent="handleLogin">
        <UFormField label="Email">
          <UInput
            v-model="form.email" type="email" placeholder="you@example.com" autofocus class="
              w-full
            "
          />
        </UFormField>
        <UFormField label="Password">
          <UInput
            v-model="form.password" type="password" placeholder="••••••••" class="
              w-full
            "
          />
        </UFormField>

        <UButton type="submit" label="Sign In" block :loading="loading" />
      </form>

      <template #footer>
        <p class="text-dimmed text-center text-sm">
          Don't have an account?
          <NuxtLink
            to="/register" class="
              text-primary
              hover:underline
            "
          >
            Register
          </NuxtLink>
        </p>
      </template>
    </UCard>
  </div>
</template>
