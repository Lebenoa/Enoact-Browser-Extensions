import { mount } from 'svelte'
import '../../public/uno.css'
import SidebarApp from './SidebarApp.svelte'
import './styles.css'

const container = document.getElementById('app')

if (container) {
    mount(SidebarApp, {
        target: container
    })
}
