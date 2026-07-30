<script>
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import { installExperienceInterceptors } from '@/utils/experience'

let stopTokenWatch

export default {
  async onLaunch() {
    installExperienceInterceptors()
    const auth = useAuthStore()
    const messages = useMessageStore()
    await auth.bootstrap()
    if (auth.token) {
      messages.initSocket(auth.token)
      messages.fetchMessages(1, 1).catch(() => undefined)
    }
    stopTokenWatch = watch(() => auth.token, (token) => {
      if (token) {
        messages.initSocket(token)
        messages.fetchMessages(1, 1).catch(() => undefined)
      } else {
        messages.closeSocket()
      }
    })
    uni.onNetworkStatusChange((state) => {
      if (state.isConnected && auth.token) {
        messages.reconnectNow()
        messages.fetchMessages(1, 1).catch(() => undefined)
      }
    })
  },
  onShow() {
    const auth = useAuthStore()
    const messages = useMessageStore()
    messages.setBackground(false)
    if (auth.token) messages.fetchMessages(1, 1).catch(() => undefined)
  },
  onHide() {
    useMessageStore().setBackground(true)
  },
  onUnload() {
    stopTokenWatch?.()
    useMessageStore().closeSocket()
  },
}
</script>

<style lang="scss">
@use './uni.scss';
@use './styles/common.scss';
@use './app.scss';
</style>
