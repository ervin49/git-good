import"./_virtual_wxt-html-plugins-Dezn_h7o.js";var e=new URLSearchParams(location.search),t=e.get(`sessionId`)??``,n=e.get(`tabTitle`)??`the tab you're recording`,r=e.get(`filename`)??`chrome-recorder-fx-${t}.webm`,i=document.getElementById(`root`);function a(e){i.innerHTML=e}function o(){a(`
    <h1>Video capture</h1>
    <p>Click the button, then select <span class="tab-name">${l(n)}</span> in the
       screen picker to start recording.</p>
    <button id="startBtn">Start video capture</button>
  `),document.getElementById(`startBtn`)?.addEventListener(`click`,p)}function s(){a(`
    <h1>Video capture</h1>
    <div class="status"><div class="dot"></div>Recording — keep this tab open</div>
    <p>Switch back to <span class="tab-name">${l(n)}</span> and reproduce the bug.
       Stop the session from the extension popup or with <kbd>Alt+Shift+S</kbd>.</p>
  `)}function c(e){a(`
    <h1>Video capture</h1>
    <p class="error">Could not start recording: ${l(e)}</p>
    <button id="retryBtn">Try again</button>
  `),document.getElementById(`retryBtn`)?.addEventListener(`click`,o)}function l(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`)}var u=null,d=null,f=!1;async function p(){try{let e=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:!0,preferCurrentTab:!0});d=await(await(await navigator.storage.getDirectory()).getFileHandle(r,{create:!0})).createWritable();let t=[`video/webm;codecs=vp9`,`video/webm`].find(e=>MediaRecorder.isTypeSupported(e));u=new MediaRecorder(e,{...t?{mimeType:t}:{}}),u.ondataavailable=async e=>{e.data.size>0&&d&&await d.write(await e.data.arrayBuffer())},u.onstop=async()=>{for(let t of e.getTracks())t.stop();try{await d?.close()}finally{d=null}chrome.runtime.sendMessage({type:`fx-video-done`,filename:r}),window.close()},u.start(5e3),s()}catch(e){c(e instanceof Error?e.message:String(e))}}chrome.runtime.onMessage.addListener(e=>(e.type===`fx-video-stop`&&u&&!f&&(f=!0,u.stop()),!1)),chrome.runtime.onConnect.addListener(()=>{}),o();