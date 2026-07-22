<script setup lang="ts">
const { signUp } = useAuth()
const toast = useToast()

const form = ref({ name: '', email: '', password: '' })
const loading = ref(false)

async function handleRegister() {
  loading.value = true
  const { error } = await signUp.email({ name: form.value.name, email: form.value.email, password: form.value.password })
  loading.value = false

  if (error) {
    toast.add({ title: error.message || 'Registration failed', color: 'error', icon: 'i-lucide-circle-x' })
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
          Create your account
        </p>
      </template>

      <form class="flex flex-col gap-4" @submit.prevent="handleRegister">
        <UFormField label="Name">
          <UInput
            v-model="form.name" placeholder="John Doe" autofocus class="w-full"
          />
        </UFormField>
        <UFormField label="Email">
          <UInput
            v-model="form.email" type="email" placeholder="you@example.com" class="
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

        <UButton type="submit" label="Create Account" block :loading="loading" />
      </form>

      <template #footer>
        <p class="text-dimmed text-center text-sm">
          Already have an account?
          <NuxtLink
            to="/login" class="
              text-primary
              hover:underline
            "
          >
            Sign in
          </NuxtLink>
        </p>
      </template>
    </UCard>
  </div>
</template>
