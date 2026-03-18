import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Input, Form, message, Tooltip } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, FormatPainterOutlined, CopyOutlined } from '@ant-design/icons';
import { useHtmlStorage } from '../hooks/useHtmlStorage';

import MonacoEditor from '@monaco-editor/react';
import prettier from 'prettier/standalone';
import * as htmlPlugin from 'prettier/plugins/html';

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getDocument, createDocument, updateDocument } = useHtmlStorage();
  const [form] = Form.useForm();

  useEffect(() => {
    if (id) {
      const doc = getDocument(id);
      if (doc) {
        form.setFieldsValue({ name: doc.name, content: doc.content });
      } else {
        message.error('Document not found');
        navigate('/');
      }
    }
  }, [id, getDocument, form, navigate]);

  const onFinish = (values: { name: string, content: string }) => {
    if (id) {
      updateDocument(id, values.name, values.content);
      message.success('Document updated successfully');
      navigate(`/render/${id}`);
    } else {
      const newDoc = createDocument(values.name, values.content);
      message.success('Document created successfully');
      navigate(`/render/${newDoc.id}`);
    }
  };

  const handleFormat = async () => {
    try {
      const currentCode = form.getFieldValue('content') || '';
      const formatted = await prettier.format(currentCode, {
        parser: 'html',
        plugins: [htmlPlugin],
        printWidth: 100,
        htmlWhitespaceSensitivity: 'ignore'
      });
      form.setFieldsValue({ content: formatted });
      message.success('Code beautifully formatted!');
    } catch {
      message.error('Format failed: please check if your HTML is valid.');
    }
  };

  const handleCopy = () => {
    const currentCode = form.getFieldValue('content') || '';
    if (!currentCode) {
      message.warning('Nothing to copy!');
      return;
    }
    navigator.clipboard.writeText(currentCode);
    message.success('Code copied to clipboard!');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-900 drop-shadow-sm flex items-center gap-3">
            {id ? 'Edit HTML Document' : 'Create New HTML Document'}
          </h1>
          <p className="text-emerald-600 mt-1">Write your raw HTML code below with rich syntax highlighting.</p>
        </div>
        <Button onClick={() => navigate('/')} icon={<ArrowLeftOutlined />} className="text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 font-medium">
          Back to Dashboard
        </Button>
      </div>

      <div className="bg-white/80 backdrop-blur-md shadow-xl shadow-emerald-100/50 rounded-2xl p-6 md:p-8 border border-emerald-50">
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark="optional">
          <Form.Item
            label={<span className="text-emerald-800 font-semibold text-base">Document Name</span>}
            name="name"
            rules={[{ required: true, message: 'Please input the document name!' }]}
          >
            <Input
              size="large"
              placeholder="E.g., Landing Page Component..."
              className="border-gray-300 focus:border-purple-400 hover:border-emerald-400 rounded-lg text-base"
            />
          </Form.Item>

          <div className="flex justify-between items-end mb-2">
            <label className="text-emerald-800 font-semibold text-base">Raw HTML Content</label>
            <div className="flex gap-2">
              <Tooltip title="Copy HTML to Clipboard">
                <Button size="small" icon={<CopyOutlined />} onClick={handleCopy} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                  Copy Code
                </Button>
              </Tooltip>
              <Tooltip title="Auto-format HTML via Prettier">
                <Button size="small" icon={<FormatPainterOutlined />} onClick={handleFormat} className="text-purple-600 border-purple-200 hover:bg-purple-50">
                  Format Code
                </Button>
              </Tooltip>
            </div>
          </div>

          <Form.Item
            name="content"
            rules={[{ required: true, message: 'Please input the HTML content!' }]}
            className="mb-8 border border-gray-200 rounded-lg overflow-hidden shadow-inner"
          >
            <MonacoEditor
              height="60vh"
              defaultLanguage="html"
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                wordWrap: 'on',
                formatOnPaste: true,
                padding: { top: 16 }
              }}
            />
          </Form.Item>

          <Form.Item className="mb-0 flex justify-end">
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={<SaveOutlined />}
              className="shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 font-semibold px-8"
            >
              Save and Render
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
