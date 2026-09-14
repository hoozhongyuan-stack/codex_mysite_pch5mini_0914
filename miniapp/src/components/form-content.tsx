import {ActionButton,ActionText,ActionTextarea,ActionView,ActionInput} from './interaction';
import { useEffect, useRef, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import {
  View,
  Text,
  Input,
  Textarea,
  Picker,
  Checkbox,
  CheckboxGroup,
  Button,
} from '@tarojs/components';
import { request, upload, token } from '../lib/api';
export default function FormContent({id, source='', embedded=false}: {id:string;source?:string;embedded?:boolean}) {
  const [form, setForm] = useState<any>(null),
    [values, setValues] = useState<any>({}),
    [agree, setAgree] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const sending=useRef(false);
  function load() {
    if (id)
      void request('/api/mini/member/form?id=' + encodeURIComponent(id))
        .then((d) => {
          setForm(d);
          setError('');
        })
        .catch((e) => setError(e.message));
  }
  useEffect(()=>{load()},[id]);
  useDidShow(()=>{load()});
  async function run(fn: () => Promise<void>) {
    if (sending.current) return;
    if(!token()){const r=await Taro.showModal({title:'登录后提交',content:'登录后可提交表单并保存记录',confirmText:'去登录',cancelText:'继续填写'});if(r.confirm)await Taro.navigateTo({url:'/pages/login/index'});return;}
    sending.current=true;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sending.current=false;
      setBusy(false);
    }
  }
  if (done) return <View className="empty">提交成功，感谢您的参与。</View>;
  return (
    <View className={embedded?"embedded-form":"content"}>
      <Text className="page-title">{form?.title || '填写表单'}</Text>
      {error && (
        <View className="notice">
          {error}
          <ActionButton
            size="mini"
            onClick={load}
          >
            重新加载
          </ActionButton>
        </View>
      )}
      {form && (
        <>
          <Text className="intro">{form.description}</Text>
          {form.fields?.map((f: any) => (
            <View key={f.id}>
              <Text className="field-label">
                {f.required ? '* ' : ''}
                {f.labelZh}
              </Text>
              {f.type === 'image' ? (
                <ActionButton
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const r = await upload('/api/mini/member/form-upload', {
                        formId: form.id,
                        fieldId: f.id,
                      });
                      setValues({ ...values, [f.id]: r.id });
                    })
                  }
                >
                  {values[f.id] ? '已上传 · 重新选择' : '选择图片'}
                </ActionButton>
              ) : f.type === 'textarea' ? (
                <ActionTextarea
                  className="field-input"
                  style={{ height: '120px' }}
                  value={values[f.id] || ''}
                  maxlength={6000}
                  onInput={(e) =>
                    setValues({ ...values, [f.id]: e.detail.value })
                  }
                />
              ) : ['date', 'time'].includes(f.type) ? (
                <Picker
                  mode={f.type}
                  value={values[f.id] || ''}
                  onChange={(e: any) =>
                    setValues({ ...values, [f.id]: e.detail.value })
                  }
                >
                  <ActionView className="field-input">
                    {values[f.id] || '请选择'}
                  </ActionView>
                </Picker>
              ) : (
                <ActionInput
                  className="field-input"
                  type={
                    f.type === 'number'
                      ? 'digit'
                      : f.type === 'phone'
                        ? 'number'
                        : 'text'
                  }
                  value={String(values[f.id] ?? '')}
                  onInput={(e) =>
                    setValues({ ...values, [f.id]: e.detail.value })
                  }
                />
              )}
            </View>
          ))}
          <View className="consent">
            <CheckboxGroup onChange={e=>setAgree(e.detail.value.includes('agree'))}><Checkbox value="agree" checked={agree} color="#2d4c39"/></CheckboxGroup>
            <ActionText
              onClick={() =>
                Taro.showModal({
                  title: '隐私政策',
                  content:
                    form.policies?.find((p: any) => p.kind === 'privacy')
                      ?.content.bodyZh || '请联系管理员完善隐私政策',
                  showCancel: false,
                })
              }
            >
              同意隐私政策
            </ActionText>
          </View>
          <View className="submit-area">
            <ActionButton
              disabled={busy || !agree}
              loading={busy}
              onClick={() =>
                run(async () => {
                  await request('/api/mini/member/form-submit', {
                    formId: form.id,
                    values,
                    formVersion: form.version,
                    privacyVersion: form.policies?.find(
                      (p: any) => p.kind === 'privacy',
                    )?.version,
                    consent: agree,
                    sourcePage: source,
                  });
                  setDone(true);
                })
              }
            >
              提交
            </ActionButton>
          </View>
        </>
      )}
    </View>
  );
}
